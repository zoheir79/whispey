# Migration d'Authentification: De Clerk à JWT

Ce document décrit la migration du système d'authentification de Clerk vers un système personnalisé basé sur email/mot de passe avec JWT.

## Résumé des Changements

1. **Suppression des dépendances**:
   - Suppression de Clerk (`@clerk/nextjs`)
   - Suppression de Supabase Auth (`@supabase/auth-helpers-nextjs`, etc.)

2. **Nouvelles dépendances**:
   - `jsonwebtoken` pour la génération et vérification des tokens JWT
   - `bcryptjs` pour le hachage des mots de passe
   - `pg` pour la connexion à PostgreSQL

3. **Modifications de la base de données**:
   - Ajout d'une colonne `password_hash` à la table `pype_voice_users`

4. **Nouveaux fichiers**:
   - `src/lib/db.ts`: Pool de connexion PostgreSQL
   - `src/lib/auth-utils.ts`: Fonctions d'authentification (inscription, connexion, vérification JWT)
   - `src/app/api/auth/register/route.ts`: Endpoint d'inscription
   - `src/app/api/auth/login/route.ts`: Endpoint de connexion
   - `src/app/api/auth/me/route.ts`: Endpoint pour récupérer les informations de l'utilisateur

5. **Fichiers modifiés**:
   - `src/middleware.ts`: Remplacé Clerk par une vérification JWT personnalisée
   - `src/components/AuthPage.tsx`: Remplacé le composant Clerk SignIn par un formulaire personnalisé
   - `src/lib/auth.ts`: Mis à jour pour utiliser PostgreSQL au lieu de Supabase
   - `src/app/auth/callback/page.tsx`: Simplifié pour fonctionner avec JWT

## Comment Exécuter la Migration

1. **Mettre à jour les variables d'environnement**:
   - Supprimer les variables Clerk et Supabase
   - Ajouter les variables PostgreSQL et JWT_SECRET

2. **Exécuter la migration SQL**:
   ```
   node run-migration.js
   ```

3. **Installer les nouvelles dépendances**:
   ```
   npm install
   ```

## Utilisation du Nouveau Système d'Authentification

### Inscription d'un utilisateur
```typescript
// POST /api/auth/register
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    first_name: 'John',
    last_name: 'Doe'
  })
});
```

### Connexion d'un utilisateur
```typescript
// POST /api/auth/login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});
```

### Récupération des informations de l'utilisateur
```typescript
// GET /api/auth/me
const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Protection des routes
Le middleware protège automatiquement toutes les routes non publiques. Les routes publiques sont définies dans le tableau `publicPaths` dans `src/middleware.ts`.

## Sécurité

- Les mots de passe sont hachés avec bcrypt avant d'être stockés dans la base de données
- Les tokens JWT sont signés avec un secret et ont une durée de validité de 7 jours
- Les tokens sont stockés dans des cookies avec l'attribut SameSite=Strict

## Notes pour la Production

1. Assurez-vous que JWT_SECRET est une chaîne aléatoire sécurisée
2. Envisagez d'ajouter l'attribut HttpOnly aux cookies pour plus de sécurité
3. En production, ajoutez l'attribut Secure aux cookies si vous utilisez HTTPS
