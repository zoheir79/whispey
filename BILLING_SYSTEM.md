# 🏦 Whispey Billing System Documentation

## 📋 Overview

Le système de facturation Whispey permet de facturer automatiquement l'utilisation des agents AI selon trois modes de tarification distincts, avec un suivi précis des métriques d'usage et une génération automatique des factures.

## 🏗️ Architecture

### Modes de Tarification

1. **Dedicated** 🔒
   - Coût fixe mensuel/annuel
   - Utilisation illimitée des modèles built-in
   - Pas de facturation à l'usage

2. **Pay-As-Go (PAG)** 💳  
   - Facturation basée sur l'usage réel
   - Tarifs par token, minute STT, mot TTS
   - Support modèles built-in et externes

3. **Hybrid** 🔄
   - Mix flexible par type de modèle (STT/TTS/LLM)
   - Chaque modèle peut être Dedicated, PAG built-in, ou PAG externe
   - Configuration granulaire par agent

## 🗄️ Structure Base de Données

### Tables Principales

#### `pype_voice_agents` (modifiée)
```sql
- platform_mode: 'dedicated' | 'pag' | 'hybrid'
- pricing_config: JSONB -- Configuration détaillée modes/tarifs
- s3_storage_gb: INTEGER DEFAULT 50
- billing_cycle: 'monthly' | 'annual'
- currency: VARCHAR(3) DEFAULT 'USD'
```

#### `monthly_consumption`
```sql
- agent_id: UUID -- Référence agent
- year_month: VARCHAR(7) -- Format 'YYYY-MM'
- stt_minutes_used: DECIMAL
- tts_words_used: INTEGER  
- llm_tokens_used: INTEGER
- s3_storage_gb: INTEGER
- total_cost: DECIMAL
- cost_breakdown: JSONB -- Détail par service
```

#### `billing_invoices`
```sql
- id: UUID PRIMARY KEY
- workspace_id: UUID -- Référence workspace
- period_start: DATE
- period_end: DATE
- billing_cycle: 'monthly' | 'annual'
- total_amount: DECIMAL
- currency: VARCHAR(3)
- status: 'draft' | 'sent' | 'paid'
- invoice_data: JSONB -- Données complètes facture
```

#### `billing_items`
```sql
- id: UUID PRIMARY KEY
- invoice_id: UUID -- FK vers billing_invoices
- agent_id: UUID -- Référence agent
- item_type: 'stt' | 'tts' | 'llm' | 'agent_fee' | 's3_storage'
- quantity: DECIMAL
- unit_cost: DECIMAL
- total_cost: DECIMAL
- usage_details: JSONB -- Détails usage
```

## 🔧 APIs

### `/api/billing/generate` (POST)
Génère une facture pour une période donnée.

**Payload:**
```json
{
  "workspace_id": "uuid",
  "period_start": "2024-12-01",
  "period_end": "2024-12-31", 
  "billing_cycle": "monthly",
  "preview": true // Optionnel, pour preview sans sauvegarde
}
```

**Réponse:**
```json
{
  "success": true,
  "invoice": {
    "id": "uuid",
    "total_amount": 156.75,
    "currency": "USD",
    "agents_summary": [...],
    "billing_items": [...]
  }
}
```

### `/api/send-logs` (POST) - Modifiée
Extrait automatiquement les métriques depuis `transcript_with_metrics` :

- **Tokens LLM** : `llm_metrics.tokens` ou `input_tokens + output_tokens`
- **Minutes STT** : `stt_metrics.duration` 
- **Mots TTS** : `tts_metrics.words` ou estimation depuis `characters_count`

## 💰 Logique de Calcul des Coûts

### Mode Dedicated
```javascript
cost = fixed_monthly_cost || fixed_annual_cost
// Pas de facturation usage
```

### Mode PAG
```javascript
stt_cost = stt_minutes * stt_rate_per_minute
tts_cost = tts_words * tts_rate_per_1k_words  
llm_cost = llm_tokens * llm_rate_per_1k_tokens
s3_cost = storage_gb * s3_rate_per_gb_month
agent_fee = base_agent_fee // Si applicable

total = stt_cost + tts_cost + llm_cost + s3_cost + agent_fee
```

### Mode Hybrid
```javascript
// Calcul séparé par modèle selon sa configuration
stt_cost = calculateModelCost('stt', stt_usage, agent.pricing_config.stt)
tts_cost = calculateModelCost('tts', tts_usage, agent.pricing_config.tts)  
llm_cost = calculateModelCost('llm', llm_usage, agent.pricing_config.llm)
```

## 🎨 Interface Utilisateur

### AgentCreationDialog
- Sélecteur mode plateforme (Dedicated/PAG/Hybrid)
- Configuration hybride avec sélection par modèle
- Estimation coûts S3 (50GB par défaut)
- Preview coûts mensuels/annuels

### BillingDashboard (`/admin/billing`)
- Liste historique factures
- Génération nouvelles factures avec preview
- Cartes résumé : total factures, agents actifs, revenus mois
- Accès restreint aux super admins

### Navigation
- Lien "Billing" dans menu admin (super admins uniquement)
- Permissions basées sur `global_role === 'super_admin'`

## ⚙️ Configuration Providers

### AIProvidersManagement
- Providers built-in marqués non-supprimables
- Edition tarifs PAG et Dedicated séparés  
- Gestion API keys sécurisée
- Badges visuels "Built-in" vs "External"

### Settings Globaux
Tarifs par défaut stockés dans `settings_global` :
```json
{
  "billing_rates": {
    "stt_per_minute": 0.006,
    "tts_per_1k_words": 0.015, 
    "llm_gpt4_per_1k_tokens": 0.03,
    "s3_storage_per_gb_month": 0.023
  }
}
```

## 🔐 Sécurité & Permissions

### Contrôle d'Accès
- **Super Admin** : Accès complet billing, tarifs, génération factures
- **Admin** : Lecture seule métriques agents
- **Member/Viewer** : Pas d'accès billing

### Validation API
- Authentification JWT obligatoire
- Validation workspace ownership
- Sanitization des inputs de dates et montants

## 📊 Métriques & Triggers

### Trigger Auto-Calcul
```sql
CREATE TRIGGER calculate_call_cost_trigger
AFTER INSERT ON pype_voice_call_logs
FOR EACH ROW EXECUTE FUNCTION calculate_call_cost();
```

### Vues Matérialisées
Agrégation automatique des métriques mensuelles pour performance.

## 🚀 Déploiement

### Migration
```bash
# Exécuter les migrations dans l'ordre
psql -d whispey -f pricing_architecture_migration.sql
psql -d whispey -f fix_billing_tables.sql
psql -d whispey -f create_builtin_providers.sql
```

### Variables d'Environnement
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
WHISPEY_API_KEY=your_api_key
```

## 🧪 Tests

### Test API Billing
```bash
curl -X POST http://localhost:3000/api/billing/generate \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"uuid","period_start":"2024-12-01","period_end":"2024-12-31","billing_cycle":"monthly","preview":true}'
```

### Test Send Logs avec Métriques
```bash
curl -X POST http://localhost:3000/api/send-logs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"call_id":"test","agent_id":"uuid","transcript_with_metrics":[...]}'
```

## 🎯 Métriques Clés

- **Précision** : Extraction directe métriques SDK Whispey
- **Performance** : Triggers auto-calcul, vues matérialisées
- **Flexibilité** : 3 modes tarification + configuration granulaire
- **Sécurité** : Permissions hiérarchiques, validation stricte
- **UX** : Interface intuitive, preview factures, estimations temps réel

---

**🔄 Version :** 1.0  
**📅 Dernière MAJ :** Décembre 2024  
**👨‍💻 Maintainer :** Équipe Whispey
