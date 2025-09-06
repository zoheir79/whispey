# 📊 ANALYSE COMPLÈTE DU SYSTÈME DE PRICING WHISPEY

## 🔍 **RÉPONSES AUX QUESTIONS SPÉCIFIQUES**

### ❓ **KB facturées par token ?**
**NON** - Les Knowledge Bases utilisent :
- **PAG** : Par requête/recherche (`kb_per_query`) + Par MB uploadé (`kb_per_upload_mb`)
- **Fixed** : Abonnement mensuel/annuel fixe

### ❓ **Workflows facturées par nbr ops et execution time ?**
**OUI** - Les Workflows utilisent :
- **PAG** : Par exécution (`workflow_per_execution`) + Par minute CPU (`workflow_per_cpu_minute`)
- **Fixed** : Abonnement mensuel/annuel fixe

---

## 📋 **TABLEAU COMPARATIF COMPLET - TOUS LES MODES DE PRICING**

### 🎯 **STT (Speech-to-Text)**
| **PROVIDER TYPE** | **MODE DEDICATED** | **MODE PAG** | **OVERRIDES** | **NOTES** |
|-------------------|-------------------|--------------|---------------|-----------|
| **🔧 Builtin STT** | 🔹 $15/mois<br>🔹 $150/an | 🔸 $0.005/minute | ✅ `builtin_stt_cost` | Whisper, Azure STT |
| **🌐 External STT** | ❌ N/A | 🔸 Prix configuré par provider | ✅ `external_stt_cost` | Providers tiers |
| **🔄 Hybrid STT** | 🔹 $15/mois base | 🔸 Builtin + External mix | ✅ Les deux overrides | Fallback externe |

### 🎯 **TTS (Text-to-Speech)**
| **PROVIDER TYPE** | **MODE DEDICATED** | **MODE PAG** | **OVERRIDES** | **NOTES** |
|-------------------|-------------------|--------------|---------------|-----------|
| **🔧 Builtin TTS** | 🔹 $12/mois<br>🔹 $120/an | 🔸 $0.003/minute<br>🔸 $0.002/mot | ✅ `builtin_tts_cost` | OpenAI TTS, Azure TTS |
| **🌐 External TTS** | ❌ N/A | 🔸 Prix configuré par provider | ✅ `external_tts_cost` | ElevenLabs, etc. |
| **🔄 Hybrid TTS** | 🔹 $12/mois base | 🔸 Builtin + External mix | ✅ Les deux overrides | Fallback externe |

### 🎯 **LLM (Large Language Models)**
| **PROVIDER TYPE** | **MODE DEDICATED** | **MODE PAG** | **OVERRIDES** | **NOTES** |
|-------------------|-------------------|--------------|---------------|-----------|
| **🔧 Builtin LLM** | 🔹 $25/mois<br>🔹 $250/an | 🔸 $0.000015/token<br>🔸 $0.002/minute | ✅ `builtin_llm_cost` | GPT-4, Claude, Gemini |
| **🌐 External LLM** | ❌ N/A | 🔸 Prix configuré par provider | ✅ `external_llm_cost` | Custom endpoints |
| **🔄 Hybrid LLM** | 🔹 $25/mois base | 🔸 Builtin + External mix | ✅ Les deux overrides | Fallback externe |

### 🎯 **AUTRES SERVICES**
| **SERVICE** | **MODE DEDICATED** | **MODE PAG** | **MODE SUBSCRIPTION** | **OVERRIDES** |
|-------------|-------------------|--------------|----------------------|---------------|
| **AGENTS TEXT** | ❌ N/A | ❌ N/A | 🟢 $19.99/mois<br>🟢 $199.90/an | ✅ `agent_monthly_cost` |
| **AGENTS VOICE** | ❌ N/A | ❌ N/A | 🟢 $29.99/mois<br>🟢 $299.90/an | ✅ `agent_monthly_cost` |
| **AGENTS VISION** | ❌ N/A | ❌ N/A | 🟢 $39.99/mois<br>🟢 $399.90/an | ✅ `agent_monthly_cost` |
| **KNOWLEDGE BASES** | 🔹 $49.99/mois<br>🔹 $499.90/an | 🔸 $0.001/requête<br>🔸 $0.01/MB upload | ❌ N/A | ✅ `kb_per_query_override` |
| **WORKFLOWS** | 🔹 $39.99/mois<br>🔹 $399.90/an | 🔸 $0.05/exécution<br>🔸 $0.02/minute CPU | ❌ N/A | ✅ `workflow_per_execution_override` |
| **S3 STORAGE** | ❌ N/A | 🔸 $0.023/GB/mois<br>🔸 $0.0004/1000 req<br>🔸 $0.09/GB transfer | ❌ N/A | ✅ `s3_storage_cost_per_gb` |

---

## 🎯 **MODES DE FACTURATION PAR CATÉGORIE**

### 🔹 **DEDICATED (Abonnement Fixe)**
- **STT, TTS, LLM** : Accès illimité aux builtin providers
- **KB, Workflow** : Utilisation illimitée sans restriction

### 🔸 **PAG (Pay-As-You-Go)**
#### **🔧 Builtin Providers**
- **STT** : $0.005/minute (Whisper, Azure STT)
- **TTS** : $0.003/minute + $0.002/mot (OpenAI TTS, Azure TTS)
- **LLM** : $0.000015/token + $0.002/minute (GPT-4, Claude, Gemini)

#### **🌐 External Providers**
- **STT** : Prix configuré par provider externe (Deepgram, AssemblyAI, etc.)
- **TTS** : Prix configuré par provider externe (ElevenLabs, Murf, etc.)  
- **LLM** : Prix configuré par provider externe (Custom API endpoints)

#### **🔄 Hybrid Mode**
- **Principe** : Builtin en priorité + Fallback vers External
- **Facturation** : Builtin rates + External rates selon utilisation
- **Use Case** : Redondance, capacité supplémentaire, modèles spécialisés

#### **🎯 Autres Services PAG**
- **KB** : $0.001/requête + $0.01/MB upload
- **Workflow** : $0.05/exécution + $0.02/minute CPU
- **S3** : $0.023/GB/mois + $0.0004/1000 req + $0.09/GB transfer

### 🟢 **SUBSCRIPTION (Agents Uniquement)**
- **Text Agents** : $19.99/mois, $199.90/an
- **Voice Agents** : $29.99/mois, $299.90/an  
- **Vision Agents** : $39.99/mois, $399.90/an

---

## 💡 **LOGIQUE DE PRICING ACTUELLE**

### **Builtin Services (STT/TTS/LLM)**
```
DEDICATED → Accès illimité builtin providers
PAG → Usage facturation granulaire
```

### **Custom Services (KB/Workflow)**
```
FIXED → Abonnement mensuel/annuel
PAG → Facturation par utilisation réelle
+ OVERRIDES possibles par KB/Workflow
```

### **Agents**
```
SUBSCRIPTION ONLY → Par type d'agent (Text/Voice/Vision)
```

### **Infrastructure (S3)**
```
PAG ONLY → Facturation par ressources consommées
```

---

## 🔧 **OVERRIDES DISPONIBLES**

### **Knowledge Bases (PAG mode)**
- `kb_per_query_override` : Prix personnalisé par requête
- `kb_per_upload_mb_override` : Prix personnalisé par MB upload

### **Workflows (PAG mode)**
- `workflow_per_execution_override` : Prix personnalisé par exécution  
- `workflow_per_cpu_minute_override` : Prix personnalisé par minute CPU

---

## 📈 **EXEMPLES DE CALCULS**

### **KB en mode PAG (1 mois)**
```
1000 requêtes + 500MB upload = 
(1000 × $0.001) + (500 × $0.01) = $1 + $5 = $6/mois
```

### **Workflow en mode PAG (1 mois)**
```
200 exécutions + 50 minutes CPU = 
(200 × $0.05) + (50 × $0.02) = $10 + $1 = $11/mois
```

### **Agent Voice (1 mois)**
```
Utilisation illimitée = $29.99/mois fixe
```

---

## ✅ **RÉSUMÉ FINAL**

| **TYPE** | **UNITÉS DE FACTURATION** | **FLEXIBILITÉ** |
|----------|---------------------------|-----------------|
| **STT/TTS/LLM** | Minute, Token, Mot | 2 modes (Dedicated/PAG) |
| **KB** | Requête + MB upload | 2 modes + Overrides |
| **Workflow** | Exécution + Minute CPU | 2 modes + Overrides |
| **Agents** | Abonnement fixe | 1 mode (Subscription) |
| **S3** | GB stockage + Requêtes | 1 mode (PAG) |

Le système offre une **granularité maximale** avec des unités de facturation adaptées à chaque service et des overrides pour personnaliser les prix par workspace/projet.
