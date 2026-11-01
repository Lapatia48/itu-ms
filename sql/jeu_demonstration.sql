-- ===========================================================================
-- ITU Motor Society — jeu de demonstration
--
-- A executer APRES sql/script_final.sql, et seulement si l'on veut une base
-- peuplee : le script de schema, seul, laisse une base vierge avec le seul
-- compte ADMIN. C'est l'etat dans lequel l'application est livree, et celui
-- que le bouton « Reinitialiser la base » de la console redonne.
--
--   psql -U postgres -d itu_ms -f sql/script_final.sql
--   psql -U postgres -d itu_ms -f sql/jeu_demonstration.sql   -- facultatif
--
-- Rejouable : il commence par rendre la base vierge, par la meme fonction que
-- le bouton de la console. Les references repartent donc de CMD-26-0001 et de
-- ART-0001 a chaque passage.
-- ===========================================================================

set client_encoding = 'UTF8';

select fn_reinitialiser(
  (select id_compte from compte where upper(etu) = 'ADMIN' and profil = 'ADMIN' and etat = 1)
);


-- ---------------------------------------------------------------------------
-- Categories — en service, ce sont les ecrans de la console qui les ouvrent.
-- ---------------------------------------------------------------------------

insert into categorie (code, libelle, ordre) values
  ('TSHIRT',     'T-shirts',     1),
  ('POLO',       'Polos',        2),
  ('SWEAT',      'Sweats',       3),
  ('VESTE',      'Vestes',       4),
  ('CASQUETTE',  'Casquettes',   5),
  ('ACCESSOIRE', 'Accessoires',  6);



-- ---------------------------------------------------------------------------
-- Comptes du jeu de demonstration
--   GEST01 / GEST02 : mot de passe « itu2026 »
--   etudiants       : mot de passe « etudiant »
--
-- Le hachage est fait par la base (pgcrypto, bcrypt) : aucune empreinte n'est
-- recopiee en clair dans ce fichier, et le cout du calcul reste du cote du
-- serveur de base.
-- ---------------------------------------------------------------------------

insert into compte (etu, nom, prenom, promotion, telephone, mot_de_passe, profil) values
  ('GEST01', 'Rakotobe',     'Fanilo', 'Bureau',  '+261 34 22 222 22',
   crypt('itu2026',  gen_salt('bf', 10)), 'GESTIONNAIRE'),
  ('GEST02', 'Ravelo',       'Miora',  'Bureau',  '+261 34 33 333 33',
   crypt('itu2026',  gen_salt('bf', 10)), 'GESTIONNAIRE'),
  ('ETU1201', 'Andrianina',  'Hery',   'L3 IG',   '+261 34 44 444 44',
   crypt('etudiant', gen_salt('bf', 10)), 'CLIENT'),
  ('ETU1388', 'Rasoanaivo',  'Tahina', 'M1 GB',   '+261 33 55 555 55',
   crypt('etudiant', gen_salt('bf', 10)), 'CLIENT'),
  ('ETU1402', 'Raharison',   'Nirina', 'L2 SR',   '+261 32 66 666 66',
   crypt('etudiant', gen_salt('bf', 10)), 'CLIENT'),
  ('ETU1455', 'Razafy',      'Lova',   'L3 IG',   '+261 34 77 777 77',
   crypt('etudiant', gen_salt('bf', 10)), 'CLIENT'),
  ('ETU1510', 'Andriamasy',  'Ony',    'M2 IG',   '+261 32 88 888 88',
   crypt('etudiant', gen_salt('bf', 10)), 'CLIENT');

-- ===========================================================================
-- Catalogue de depart
-- ===========================================================================

insert into produit (id_categorie, nom, description, prix, couleur, cree_le) values
  ((select id_categorie from categorie where code = 'TSHIRT'),
   'T-shirt Racing Marine', 'Coton 180 g, sérigraphie du logo sur la poitrine et numéro dans le dos.',
   38000, 'Marine', now() - interval '60 days'),
  ((select id_categorie from categorie where code = 'TSHIRT'),
   'T-shirt Piste Blanc', 'Coton 180 g, logo rouge grand format au dos.',
   38000, 'Blanc', now() - interval '58 days'),
  ((select id_categorie from categorie where code = 'TSHIRT'),
   'T-shirt Grid Rouge', 'Coton 180 g, bandes obliques sur la manche gauche.',
   40000, 'Rouge', now() - interval '45 days'),
  ((select id_categorie from categorie where code = 'POLO'),
   'Polo Paddock', 'Piqué de coton, col boutonné, logo brodé.',
   65000, 'Marine', now() - interval '52 days'),
  ((select id_categorie from categorie where code = 'POLO'),
   'Polo Équipe Blanc', 'Piqué de coton, liseré rouge au col et aux manches.',
   68000, 'Blanc', now() - interval '40 days'),
  ((select id_categorie from categorie where code = 'SWEAT'),
   'Sweat à capuche Motor', 'Molleton gratté 320 g, poche kangourou, cordon rouge.',
   115000, 'Marine', now() - interval '50 days'),
  ((select id_categorie from categorie where code = 'SWEAT'),
   'Sweat Col Rond Atelier', 'Molleton 300 g, logo brodé poitrine.',
   98000, 'Gris chiné', now() - interval '35 days'),
  ((select id_categorie from categorie where code = 'VESTE'),
   'Veste Coupe-vent Circuit', 'Nylon déperlant, doublure filet, fermeture pleine longueur.',
   185000, 'Marine', now() - interval '30 days'),
  ((select id_categorie from categorie where code = 'VESTE'),
   'Veste Softshell Mécano', 'Trois couches, poches zippées, logo au dos.',
   240000, 'Noir', now() - interval '25 days'),
  ((select id_categorie from categorie where code = 'CASQUETTE'),
   'Casquette Pit Stop', 'Six panneaux, visière courbée, fermeture réglable.',
   32000, 'Marine', now() - interval '48 days'),
  ((select id_categorie from categorie where code = 'CASQUETTE'),
   'Bonnet Hivernage', 'Maille côtelée, revers brodé.',
   28000, 'Rouge', now() - interval '20 days'),
  ((select id_categorie from categorie where code = 'ACCESSOIRE'),
   'Tote bag Garage', 'Toile 240 g, anses longues, impression recto.',
   22000, 'Écru', now() - interval '18 days'),
  ((select id_categorie from categorie where code = 'ACCESSOIRE'),
   'Écharpe Supporter', 'Maille jacquard, franges, deux faces.',
   35000, 'Marine', now() - interval '15 days'),
  ((select id_categorie from categorie where code = 'ACCESSOIRE'),
   'Lot de 5 autocollants', 'Vinyle découpé, résistant à l''eau.',
   12000, 'Rouge', now() - interval '12 days');

-- Tailles proposees : vetements en S a XXL, accessoires en taille unique.
insert into produit_taille (id_produit, id_taille)
select p.id_produit, t.id_taille
  from produit p
  join categorie c on c.id_categorie = p.id_categorie
  join taille t on t.code in ('S', 'M', 'L', 'XL', 'XXL')
 where c.code in ('TSHIRT', 'POLO', 'SWEAT', 'VESTE');

insert into produit_taille (id_produit, id_taille)
select p.id_produit, t.id_taille
  from produit p
  join categorie c on c.id_categorie = p.id_categorie
  join taille t on t.code = 'TU'
 where c.code in ('CASQUETTE', 'ACCESSOIRE');


-- ===========================================================================
-- Commandes de depart
--
-- L'ordre compte : articles, puis encaissements, puis statuts. Une
-- confirmation exige l'acompte, une livraison exige le solde.
-- ===========================================================================

do $$
declare
  v_gest     integer := (select id_compte from compte where etu = 'GEST01');
  v_cmd      integer;
begin
  -- CMD-26-0001 : livree et soldee
  insert into commande (id_compte, remarque, cree_le)
  values ((select id_compte from compte where etu = 'ETU1201'),
          'Retrait au local du club.', now() - interval '28 days')
  returning id_commande into v_cmd;
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'L'), 2, p.prix
    from produit p where p.nom = 'T-shirt Racing Marine';
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'TU'), 1, p.prix
    from produit p where p.nom = 'Casquette Pit Stop';
  insert into paiement (id_commande, montant, code_mode, date_paiement, id_compte)
  values (v_cmd, 54000, 'MVOLA', (now() - interval '27 days')::date, v_gest),
         (v_cmd, 54000, 'ESPECES', (now() - interval '22 days')::date, v_gest);
  insert into commande_statut (id_commande, code_statut, date_statut, id_compte) values
    (v_cmd, 'CONFIRMEE',      now() - interval '27 days', v_gest),
    (v_cmd, 'EN_PREPARATION', now() - interval '25 days', v_gest),
    (v_cmd, 'PRETE',          now() - interval '23 days', v_gest),
    (v_cmd, 'LIVREE',         now() - interval '22 days', v_gest);

  -- CMD-26-0002 : livree et soldee, pour un second avis
  insert into commande (id_compte, cree_le)
  values ((select id_compte from compte where etu = 'ETU1388'), now() - interval '24 days')
  returning id_commande into v_cmd;
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'M'), 1, p.prix
    from produit p where p.nom = 'Sweat à capuche Motor';
  insert into paiement (id_commande, montant, code_mode, date_paiement, id_compte)
  values (v_cmd, 115000, 'ORANGE_MONEY', (now() - interval '23 days')::date, v_gest);
  insert into commande_statut (id_commande, code_statut, date_statut, id_compte) values
    (v_cmd, 'CONFIRMEE',      now() - interval '23 days', v_gest),
    (v_cmd, 'EN_PREPARATION', now() - interval '20 days', v_gest),
    (v_cmd, 'PRETE',          now() - interval '18 days', v_gest),
    (v_cmd, 'LIVREE',         now() - interval '17 days', v_gest);

  -- CMD-26-0003 : prete, acompte verse, solde attendu au retrait
  insert into commande (id_compte, remarque, cree_le)
  values ((select id_compte from compte where etu = 'ETU1402'),
          'Promotion L2 SR, commande groupée.', now() - interval '12 days')
  returning id_commande into v_cmd;
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'XL'), 1, p.prix
    from produit p where p.nom = 'Veste Coupe-vent Circuit';
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'XL'), 2, p.prix
    from produit p where p.nom = 'Polo Paddock';
  insert into paiement (id_commande, montant, code_mode, date_paiement, id_compte)
  values (v_cmd, 160000, 'MVOLA', (now() - interval '11 days')::date, v_gest);
  insert into commande_statut (id_commande, code_statut, date_statut, id_compte) values
    (v_cmd, 'CONFIRMEE',      now() - interval '11 days', v_gest),
    (v_cmd, 'EN_PREPARATION', now() - interval '8 days',  v_gest),
    (v_cmd, 'PRETE',          now() - interval '4 days',  v_gest);

  -- CMD-26-0004 : en preparation
  insert into commande (id_compte, cree_le)
  values ((select id_compte from compte where etu = 'ETU1455'), now() - interval '9 days')
  returning id_commande into v_cmd;
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'S'), 1, p.prix
    from produit p where p.nom = 'T-shirt Piste Blanc';
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'TU'), 1, p.prix
    from produit p where p.nom = 'Tote bag Garage';
  insert into paiement (id_commande, montant, code_mode, date_paiement, id_compte)
  values (v_cmd, 30000, 'ESPECES', (now() - interval '8 days')::date, v_gest);
  insert into commande_statut (id_commande, code_statut, date_statut, id_compte) values
    (v_cmd, 'CONFIRMEE',      now() - interval '8 days', v_gest),
    (v_cmd, 'EN_PREPARATION', now() - interval '5 days', v_gest);

  -- CMD-26-0005 : nouvelle, rien d'encaisse
  insert into commande (id_compte, remarque, cree_le)
  values ((select id_compte from compte where etu = 'ETU1510'),
          'Je passe au local vendredi après-midi.', now() - interval '3 days')
  returning id_commande into v_cmd;
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'M'), 1, p.prix
    from produit p where p.nom = 'Veste Softshell Mécano';

  -- CMD-26-0006 : nouvelle, acompte deja verse
  insert into commande (id_compte, cree_le)
  values ((select id_compte from compte where etu = 'ETU1201'), now() - interval '2 days')
  returning id_commande into v_cmd;
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'L'), 3, p.prix
    from produit p where p.nom = 'T-shirt Grid Rouge';
  insert into paiement (id_commande, montant, code_mode, reference, date_paiement, id_compte)
  values (v_cmd, 60000, 'MVOLA', '0341234567', (now() - interval '1 day')::date, v_gest);

  -- CMD-26-0007 : annulee
  insert into commande (id_compte, cree_le)
  values ((select id_compte from compte where etu = 'ETU1388'), now() - interval '6 days')
  returning id_commande into v_cmd;
  insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
  select v_cmd, p.id_produit, (select id_taille from taille where code = 'XXL'), 1, p.prix
    from produit p where p.nom = 'Polo Équipe Blanc';
  insert into commande_statut (id_commande, code_statut, date_statut, id_compte, commentaire)
  values (v_cmd, 'ANNULEE', now() - interval '5 days',
          (select id_compte from compte where etu = 'ETU1388'), 'Taille indisponible, à recommander.');
end $$;

insert into avis (id_produit, id_compte, note, commentaire, cree_le)
values
  ((select id_produit from produit where nom = 'T-shirt Racing Marine'),
   (select id_compte from compte where etu = 'ETU1201'),
   5, 'Coupe fidèle à la taille, le marquage a tenu après plusieurs lavages.',
   now() - interval '20 days'),
  ((select id_produit from produit where nom = 'Sweat à capuche Motor'),
   (select id_compte from compte where etu = 'ETU1388'),
   5, 'Molleton épais, parfait pour les sorties du matin.',
   now() - interval '15 days');
