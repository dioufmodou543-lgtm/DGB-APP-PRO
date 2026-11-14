# DGB App PRO — Audit & améliorations

## 1. Failles corrigées (sécurité & contrôle d'accès)

| Problème constaté | Correction |
|---|---|
| Le serveur faisait confiance à l'en-tête `x-user-role` : un étudiant pouvait se déclarer « admin » et **réinitialiser toute la base**. | Le rôle n'est accepté que s'il est réellement attribué à l'utilisateur (`server/security.ts`). |
| Aucune vérification de rôle sur la plupart des routes (un étudiant pouvait clôturer l'année académique, encaisser, saisir des dépenses…). | Chaque route sensible déclare ses rôles autorisés (`requireRoles`). |
| `/api/bootstrap` envoyait **toute la base** (tous les étudiants, factures, audit) à un étudiant. | Cloisonnement : un étudiant ne reçoit que ses propres données et ses notes publiées. |
| Jetons de sécurité des diplômes générés avec `Math.random` (prévisibles). | Générateur cryptographique (`crypto.randomBytes`). |
| Pas d'en-têtes de sécurité, pas de limite de taille des requêtes, erreurs JSON renvoyées en HTML. | En-têtes de sécurité, `Cache-Control: no-store` sur l'API, limite 1 Mo, erreurs JSON propres. |

## 2. Règles de gestion renforcées

- **Encaissements** : trop-perçu refusé, facture devant appartenir à l'étudiant, référence Wave/OM non réutilisable, espèces impossibles sans caisse ouverte, **ventilation FIFO** automatique sur plusieurs échéances.
- **Annulation** : rétablit chaque échéance ventilée ; un remboursement en espèces est tracé comme sortie de caisse.
- **Caisse** : impossible d'ouvrir une 2ᵉ session, retrait limité au solde, justification obligatoire en cas d'écart à la clôture.
- **Dépenses** : cycle strictement progressif (pas de retour arrière), ordonnancement réservé à la direction (séparation des tâches).
- **Notes** : bornées entre 0 et 20, notes validées/publiées verrouillées pour les enseignants, saisie par lot « tout ou rien ».
- **Inscriptions** : doublon d'inscription (même année) et doublon de CNI refusés.
- **Numérotation** : basée sur le plus grand numéro existant (plus de doublons après suppression/import).
- **Retards** : statut « en retard » calculé automatiquement (factures et prêts).
- **Base JSON** : écriture atomique (pas de fichier corrompu en cas de coupure).

## 3. Bugs corrigés

- Page **Tests & Calculs** toujours vide (0/0) : mauvais format lu côté client.
- Page **Paramétrage** : le bouton « Enregistrer » n'enregistrait rien et les champs n'affichaient pas la vraie configuration ; titres d'année vides.
- Choisir « Direction Générale » dans le sélecteur basculait en « Administrateur ».
- Les refus du serveur étaient masqués par le mode hors-ligne (l'écran affichait une opération refusée comme réussie).
- La fiche étudiant n'était pas rafraîchie après admission/inscription.
- Chaque écriture en base provoquait un rechargement complet de la page en développement.

## 4. Nouvelles fonctionnalités

1. **Recouvrement & Relances** (menu Comptabilité) : balance âgée (non échu, 1–30, 31–60, 61–90, > 90 j), taux de recouvrement, score de risque, relances WhatsApp/SMS/e-mail pré-rédigées en 3 niveaux (courtoise, ferme, mise en demeure), promesses de paiement, journal des relances, export Excel.
2. **Relevé de compte étudiant PDF** (depuis le recouvrement ou la fiche étudiant).
3. **Recherche globale `Ctrl + K`** : étudiants, matricules, factures, reçus, ouvrages, modules.
4. **Centre d'alertes** (cloche) : impayés, promesses non tenues, caisse non clôturée, dettes fournisseurs échues, prêts en retard, notes à valider, émargements non signés, agréments expirant.
5. **Modification du dossier étudiant** (tracée dans l'audit).
6. **Sauvegarde / restauration** complète de la base (Paramétrage).
7. **Exports Excel** (CSV compatible Excel FR) : étudiants, factures, encaissements, dépenses, balance âgée.
8. **6 nouveaux contrôles d'intégrité** exécutés sur les données réelles (13 au total).

## 5. Recommandations pour la suite

- **Authentification réelle** (mot de passe / OTP par SMS) : aujourd'hui le changement de rôle reste libre dans l'interface de démonstration.
- **Base de données** (PostgreSQL / SQLite) à la place du fichier JSON dès plusieurs utilisateurs simultanés.
- **Intégration API Wave / Orange Money** (webhooks) et passerelle SMS pour l'envoi automatique des relances.
