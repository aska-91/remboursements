# Suivi des remboursements attendus

## Objectif
Application personnelle pour ne jamais perdre de vue une dépense dont on attend un remboursement, avec un historique complet. Deux cas principaux :
- **Santé** : consultation (généraliste, spécialiste), pharmacie, dentiste/optique, examens. Remboursement par la Sécurité sociale et/ou la mutuelle.
- **Shopping** : article acheté puis retourné, remboursement par l'enseigne (carte, avoir ou bon d'achat).

Usage pour une seule personne pour l'instant (pas de partage). Doit fonctionner aussi bien sur Android que sur ordinateur (mise en page adaptative, tactile et clavier/souris).

**Langues** : interface de l'application en **anglais** (tous les textes dans `src/ui/strings.ts`). Code, noms et messages de commit en anglais. Les échanges avec l'utilisateur restent en **français**.

**Formats** : dates JJ/MM/AAAA ; montants en euros au format anglais (`€12.50`) ; « Sécurité sociale » et « Mutuelle » gardent leur nom français ; export CSV avec séparateur `;`.

## Point de départ
`prototype/index.html` est un prototype fonctionnel en un seul fichier (HTML, CSS, JS sans dépendance). Il sert de référence pour le comportement et le design. Reprendre ses règles métier telles quelles, puis structurer le code proprement.

## Modèle de données
**Dépense (claim)** : id, date, libellé, catégorie (Médecin généraliste, Médecin spécialiste, Pharmacie, Dentiste / Optique, Examens / Analyses, Retour d'article, Autre), montant avancé, référence, notes, archivée (bool), issue (vide ou « annulée »), mod (horodatage de dernière modification), journal.
- Champs shopping : date limite de retour, date de retour effectif, n° de suivi, mode de remboursement (moyen de paiement, avoir/bon d'achat, autre).
- Champs santé : « demande à envoyer moi-même » (bool), date limite pour réclamer (proposée à date + 2 ans, à vérifier selon le contrat), date d'envoi.
- Journal : liste d'événements {horodatage, texte}, jamais supprimés.

**Ligne de remboursement attendu (item)** : source (Sécurité sociale, Mutuelle, Enseigne, Autre), montant attendu, date prévue, montant reçu (cumulé), date de réception, classé en reste à charge (bool), refusé (bool) + motif, date de dernière relance.

## Règles métier
- **État d'une ligne** : refusé ; reçu (reçu >= attendu) ; écart (reçu < attendu, non classé) ; reste à charge (écart classé) ; en retard (non reçu, date prévue passée) ; en attente. Pour un retour d'article non encore retourné, la ligne reste « en attente » et n'est jamais en retard.
- **État d'une dépense** : annulée ; à retourner (shopping non retourné, « en retard » si la date limite est passée) ; en retard (ligne en retard, ou délai de réclamation dépassé) ; écart à relancer ; demande à envoyer ; partiel ; en attente ; reçu (toutes lignes closes sans refus) ; refusé.
- **Reste à recevoir** = lignes en attente ou en retard (montant attendu) + écarts (montant manquant).
- **Reste à charge prévu** = avancé − reçu − reste à recevoir (hors dépenses annulées).
- **Aucune suppression directe** : on archive (seulement une dépense terminée, refusée ou annulée) ou on annule avec une raison. La suppression définitive n'est possible que depuis les archives, avec confirmation.
- Réception partielle : proposer de classer le manque en reste à charge ou de le laisser à relancer. Versements complémentaires cumulés.
- Marquer un article retourné : fixer par défaut la date de remboursement attendue à date de retour + 14 jours (modifiable).
- Chaque action (création, modification, réception, relance, refus, retour, envoi, archivage, annulation, note) ajoute une entrée au journal.

## Écrans et fonctions
1. **Synthèse** : reste à recevoir, nombre d'éléments à traiter, déjà reçu, reste à charge, répartition par source.
2. **À traiter** : retours à expédier (alerte à 7 jours), demandes à envoyer (alerte à 30 jours), lignes en retard, écarts, avec actions directes.
3. **Liste** filtrable : En cours, À relancer, Terminées, Refusées/annulées, Archives, Tous ; recherche libre (y compris dans le journal) ; filtre par catégorie. Tri : urgence d'abord, puis prochaine date prévue.
4. **Carte de dépense** : statut, montants, étapes shopping (à retourner, retourné, remboursement), ligne de demande santé, lignes de remboursement avec actions, historique repliable.
5. **Formulaire** d'ajout et de modification, avec lignes pré-remplies (Sécurité sociale + Mutuelle, ou Enseigne pour un retour).
6. **Bilan par année** : dépenses, avancé, reçu, à recevoir, reste à charge.
7. **Sauvegarde** : export CSV (une ligne par remboursement, journal inclus), export JSON complet, import JSON par fusion sans perte (la version la plus récente gagne, suppressions suivies).

## À ajouter ensuite (par ordre de priorité)
1. Rappels (notification ou e-mail hebdomadaire) pour les éléments à traiter.
2. Pièces à fournir par dépense (feuille de soins, ordonnance, facture, preuve de retour), avec case « envoyée » et pièces jointes (photos, PDF).
3. Bénéficiaire (membre de la famille) et filtre associé.
4. Rapprochement avec un relevé bancaire (import CSV) pour pointer les remboursements reçus.
5. Dépassements d'honoraires : reste à charge prévu comparé au reste à charge réel.

## Contraintes techniques souhaitées
- Application web installable sur téléphone (PWA), qui fonctionne hors ligne.
- Données stockées en local sur l'appareil par défaut (IndexedDB), avec sauvegarde/export simple. Prévoir une couche de stockage remplaçable pour ajouter plus tard une synchronisation entre appareils.
- Pas de compte ni de service tiers au départ. Aucune donnée de santé envoyée à un serveur sans accord explicite.
- Accessible (clavier, contrastes, thème clair et sombre), mobile d'abord.
- Tests unitaires sur les règles métier (états, montants, fusion de données), dates calculées en fuseau Europe/Paris.

## Pile et structure (validées)
TypeScript strict, Vite, Preact, IndexedDB (`idb`), vite-plugin-pwa, Vitest, Playwright pour vérifier les rendus téléphone (390 px) et ordinateur (1280 px).
- `src/domain/` : règles métier pures (aucune dépendance au DOM ni au stockage), couvertes par les tests dans `tests/`.
- `src/storage/` : interface de stockage remplaçable + implémentation IndexedDB.
- `src/export/` : CSV et JSON.
- `src/ui/` : écrans Preact, `strings.ts`, styles.
- Les tests tournent dans un fuseau éloigné de Paris (`TZ=Pacific/Auckland`) pour détecter toute dépendance au fuseau de la machine.

Commandes : `npm run dev`, `npm test`, `npm run build`.

## Pour démarrer
1. Lire `prototype/index.html` et résumer les règles métier en tests.
2. Proposer une structure de projet et une pile technique simples avant de coder (par défaut : TypeScript, Vite, framework léger, IndexedDB).
3. Migrer le prototype par étapes, en gardant le comportement identique, puis ajouter la liste « À ajouter ensuite ».
