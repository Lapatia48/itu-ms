-- ===========================================================================
-- ITU Motor Society — suivi de commandes
-- Dump de conception : create database itu_ms, puis executer ce fichier.
-- Toute correction de schema se fait ICI, jamais en ALTER sur une base vivante.
--
-- Conventions
--   . Suppression logique partout : etat = 1 actif, 0 corbeille. Aucun DELETE.
--   . Le cycle de vie d'une commande vit dans commande_statut (table de
--     liaison) : cette commande, a cette date, est dans cet etat, par ce compte.
--   . Les droits de passage vivent dans transition_commande_profil, relus en
--     base a chaque appel.
--   . Montants en ariary, NUMERIC(12,2).
-- ===========================================================================

set client_encoding = 'UTF8';

-- Le hachage des mots de passe est fait par la base, en bcrypt. Deux raisons :
-- l'API tourne sur un hebergement qui plafonne le temps processeur par requete
-- (10 ms chez Cloudflare Workers) et un scrypt y serait tue en vol, alors
-- qu'attendre la base ne compte pas ; et le mot de passe en clair ne traverse
-- jamais le code applicatif autrement que comme parametre de requete.
create extension if not exists pgcrypto;

drop view if exists v_corbeille cascade;
drop view if exists v_commande cascade;
drop view if exists v_commande_statut cascade;
drop view if exists v_produit cascade;
drop view if exists v_avis cascade;

drop function if exists fn_reinitialiser(integer);

drop table if exists avis cascade;
drop table if exists paiement cascade;
drop table if exists commande_statut cascade;
drop table if exists commande_ligne cascade;
drop table if exists commande cascade;
drop table if exists produit_image cascade;
drop table if exists produit_taille cascade;
drop table if exists produit cascade;
drop table if exists categorie cascade;
drop table if exists taille cascade;
drop table if exists transition_commande_profil cascade;
drop table if exists transition_commande cascade;
drop table if exists statut_commande cascade;
drop table if exists mode_paiement cascade;
drop table if exists compte cascade;
drop table if exists parametre cascade;

drop sequence if exists seq_reference_commande;
drop sequence if exists seq_reference_produit;


-- ---------------------------------------------------------------------------
-- Parametres
-- ---------------------------------------------------------------------------

create table parametre (
  cle           varchar(40)  primary key,
  valeur        varchar(100) not null,
  libelle       varchar(120) not null,
  maj_le        timestamptz  not null default now()
);


-- ---------------------------------------------------------------------------
-- Comptes
--
-- Une seule table pour la boutique et la console : le numero ETU est
-- l'identifiant de connexion, le bureau de l'association en a un comme les
-- autres etudiants.
-- ---------------------------------------------------------------------------

create table compte (
  id_compte     serial       primary key,
  etu           varchar(20)  not null,
  nom           varchar(60)  not null,
  prenom        varchar(60)  not null,
  promotion     varchar(60)  not null,
  telephone     varchar(30)  not null,
  mot_de_passe  varchar(160) not null,
  profil        varchar(20)  not null default 'CLIENT',
  etat          smallint     not null default 1,
  cree_le       timestamptz  not null default now(),
  supprime_le   timestamptz,
  supprime_par  integer      references compte(id_compte),
  constraint chk_compte_profil check (profil in ('CLIENT', 'GESTIONNAIRE', 'ADMIN')),
  constraint chk_compte_etat   check (etat in (0, 1))
);

-- L'unicite ne vaut que sur les comptes vivants : un ETU parti a la corbeille
-- ne bloque pas une reinscription.
create unique index uq_compte_etu on compte (upper(etu)) where etat = 1;
create index idx_compte_profil on compte (profil) where etat = 1;


-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table categorie (
  id_categorie  serial      primary key,
  code          varchar(30) not null,
  libelle       varchar(80) not null,
  ordre         smallint    not null default 0,
  etat          smallint    not null default 1,
  cree_le       timestamptz not null default now(),
  supprime_le   timestamptz,
  supprime_par  integer     references compte(id_compte),
  constraint chk_categorie_etat check (etat in (0, 1))
);
create unique index uq_categorie_code on categorie (upper(code)) where etat = 1;

create table taille (
  id_taille     serial      primary key,
  code          varchar(10) not null,
  libelle       varchar(40) not null,
  ordre         smallint    not null default 0,
  etat          smallint    not null default 1,
  constraint chk_taille_etat check (etat in (0, 1))
);
create unique index uq_taille_code on taille (upper(code)) where etat = 1;

create sequence seq_reference_produit;

create table produit (
  id_produit    serial        primary key,
  reference     varchar(20)   not null unique,
  id_categorie  integer       not null references categorie(id_categorie),
  nom           varchar(120)  not null,
  description   text,
  prix          numeric(12,2) not null,
  couleur       varchar(40),
  image         varchar(200),
  etat          smallint      not null default 1,
  cree_le       timestamptz   not null default now(),
  maj_le        timestamptz   not null default now(),
  supprime_le   timestamptz,
  supprime_par  integer       references compte(id_compte),
  constraint chk_produit_prix check (prix > 0),
  constraint chk_produit_etat check (etat in (0, 1))
);
create index idx_produit_categorie on produit (id_categorie) where etat = 1;

-- Les tailles proposees pour un article. Aucun stock : cette table dit ce
-- qu'on peut commander, pas ce qui reste.
create table produit_taille (
  id_produit    integer not null references produit(id_produit) on delete cascade,
  id_taille     integer not null references taille(id_taille),
  primary key (id_produit, id_taille)
);

-- Les photos d'articles sont stockees ICI, pas sur le disque du serveur :
-- l'API tourne sans systeme de fichiers persistant (Cloudflare Workers), et un
-- hebergement gratuit efface son disque a chaque redemarrage. La cle est le nom
-- servi dans l'URL (/images/<nom>) : il est tire au depot et ne se reutilise
-- pas, ce qui rend la reponse cachable sans fin.
create table produit_image (
  nom           varchar(200) primary key,
  id_produit    integer      not null references produit(id_produit) on delete cascade,
  type_mime     varchar(20)  not null,
  octets        bytea        not null,
  cree_le       timestamptz  not null default now(),
  constraint chk_image_mime check (type_mime in ('image/jpeg', 'image/png', 'image/webp'))
);
create index idx_produit_image_produit on produit_image (id_produit);


-- ---------------------------------------------------------------------------
-- Cycle de vie d'une commande : statuts et transitions, parametres en base
-- ---------------------------------------------------------------------------

create table statut_commande (
  code          varchar(20) primary key,
  libelle       varchar(60) not null,
  ordre         smallint    not null,
  est_initial   boolean     not null default false,
  est_final     boolean     not null default false,
  ton           varchar(10) not null default 'neutral',
  constraint chk_statut_ton check (ton in ('neutral', 'info', 'ok', 'warn', 'danger'))
);

create table transition_commande (
  code_depuis   varchar(20) not null references statut_commande(code),
  code_vers     varchar(20) not null references statut_commande(code),
  libelle       varchar(60) not null,
  primary key (code_depuis, code_vers)
);

-- Qui franchit ce passage. Une transition sans profil declare n'est
-- franchissable par personne, et la matrice de la console le montre.
create table transition_commande_profil (
  code_depuis   varchar(20) not null,
  code_vers     varchar(20) not null,
  profil        varchar(20) not null,
  primary key (code_depuis, code_vers, profil),
  foreign key (code_depuis, code_vers)
    references transition_commande(code_depuis, code_vers) on delete cascade,
  constraint chk_transition_profil check (profil in ('CLIENT', 'GESTIONNAIRE', 'ADMIN'))
);

create table mode_paiement (
  code          varchar(20) primary key,
  libelle       varchar(40) not null,
  ordre         smallint    not null default 0,
  etat          smallint    not null default 1,
  constraint chk_mode_etat check (etat in (0, 1))
);


-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------

create sequence seq_reference_commande;

create table commande (
  id_commande   serial      primary key,
  reference     varchar(20) not null unique,
  id_compte     integer     not null references compte(id_compte),
  remarque      text,
  etat          smallint    not null default 1,
  cree_le       timestamptz not null default now(),
  supprime_le   timestamptz,
  supprime_par  integer     references compte(id_compte),
  constraint chk_commande_etat check (etat in (0, 1))
);
create index idx_commande_compte on commande (id_compte) where etat = 1;

-- Le prix est recopie a la commande : une hausse de tarif ne doit pas
-- reecrire ce que l'etudiant a accepte de payer.
create table commande_ligne (
  id_ligne      serial        primary key,
  id_commande   integer       not null references commande(id_commande) on delete cascade,
  id_produit    integer       not null references produit(id_produit),
  id_taille     integer       references taille(id_taille),
  quantite      smallint      not null,
  prix_unitaire numeric(12,2) not null,
  constraint chk_ligne_quantite check (quantite between 1 and 99),
  constraint chk_ligne_prix check (prix_unitaire > 0)
);
create index idx_ligne_commande on commande_ligne (id_commande);

-- Une ligne par passage, jamais de mise a jour : c'est l'historique que la
-- fiche affiche, et il dit qui a fait quoi, quand.
create table commande_statut (
  id_commande_statut serial      primary key,
  id_commande        integer     not null references commande(id_commande) on delete cascade,
  code_statut        varchar(20) not null references statut_commande(code),
  date_statut        timestamptz not null default now(),
  id_compte          integer     references compte(id_compte),
  commentaire        text
);
create index idx_commande_statut on commande_statut (id_commande, date_statut desc, id_commande_statut desc);

create table paiement (
  id_paiement   serial        primary key,
  id_commande   integer       not null references commande(id_commande),
  montant       numeric(12,2) not null,
  code_mode     varchar(20)   not null references mode_paiement(code),
  reference     varchar(60),
  date_paiement date          not null default current_date,
  commentaire   text,
  id_compte     integer       references compte(id_compte),
  etat          smallint      not null default 1,
  cree_le       timestamptz   not null default now(),
  supprime_le   timestamptz,
  supprime_par  integer       references compte(id_compte),
  constraint chk_paiement_montant check (montant > 0),
  constraint chk_paiement_etat check (etat in (0, 1))
);
create index idx_paiement_commande on paiement (id_commande) where etat = 1;


-- ---------------------------------------------------------------------------
-- Avis
-- ---------------------------------------------------------------------------

create table avis (
  id_avis       serial      primary key,
  id_produit    integer     not null references produit(id_produit),
  id_compte     integer     not null references compte(id_compte),
  note          smallint    not null,
  commentaire   text,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  etat          smallint    not null default 1,
  supprime_le   timestamptz,
  supprime_par  integer     references compte(id_compte),
  constraint chk_avis_note check (note between 1 and 5),
  constraint chk_avis_etat check (etat in (0, 1))
);
create unique index uq_avis_produit_compte on avis (id_produit, id_compte) where etat = 1;


-- ===========================================================================
-- Declencheurs
-- ===========================================================================

create or replace function fn_reference_commande() returns trigger as $$
begin
  if new.reference is null then
    new.reference := 'CMD-' || to_char(new.cree_le, 'YY') || '-'
                  || lpad(nextval('seq_reference_commande')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_reference_commande before insert on commande
  for each row execute function fn_reference_commande();

create or replace function fn_reference_produit() returns trigger as $$
begin
  if new.reference is null then
    new.reference := 'ART-' || lpad(nextval('seq_reference_produit')::text, 4, '0');
  end if;
  new.maj_le := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_reference_produit before insert or update on produit
  for each row execute function fn_reference_produit();

-- La commande naît a son statut initial, pose a sa date de creation : sans
-- cela une commande reprise a une date passee serait datee d'aujourd'hui.
create or replace function fn_commande_statut_initial() returns trigger as $$
begin
  insert into commande_statut (id_commande, code_statut, date_statut, id_compte)
  select new.id_commande, code, new.cree_le, new.id_compte
    from statut_commande where est_initial;
  return new;
end;
$$ language plpgsql;

create trigger trg_commande_statut_initial after insert on commande
  for each row execute function fn_commande_statut_initial();

create or replace function fn_statut_courant(p_commande integer)
returns varchar as $$
  select cs.code_statut
    from commande_statut cs
   where cs.id_commande = p_commande
   order by cs.date_statut desc, cs.id_commande_statut desc
   limit 1;
$$ language sql stable;

create or replace function fn_total_commande(p_commande integer)
returns numeric as $$
  select coalesce(sum(quantite * prix_unitaire), 0)
    from commande_ligne where id_commande = p_commande;
$$ language sql stable;

create or replace function fn_paye_commande(p_commande integer)
returns numeric as $$
  select coalesce(sum(montant), 0)
    from paiement where id_commande = p_commande and etat = 1;
$$ language sql stable;

-- Le passage d'un statut a l'autre : le chemin doit etre declare, le profil
-- doit y avoir droit, et l'argent doit suivre. Trois refus distincts, chacun
-- avec son message : « impossible » sans motif ne se corrige pas.
create or replace function fn_chk_transition() returns trigger as $$
declare
  v_courant varchar(20);
  v_profil  varchar(20);
  v_total   numeric;
  v_paye    numeric;
  v_minimum numeric;
  v_reste   numeric;
begin
  select fn_statut_courant(new.id_commande) into v_courant;

  if v_courant is null then
    if not exists (select 1 from statut_commande where code = new.code_statut and est_initial) then
      raise exception 'Une commande commence a son statut initial.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if v_courant = new.code_statut then
    raise exception 'Commande deja au statut %.', new.code_statut using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from transition_commande
     where code_depuis = v_courant and code_vers = new.code_statut
  ) then
    raise exception 'Passage de % a % non prevu.', v_courant, new.code_statut
      using errcode = 'check_violation';
  end if;

  if new.id_compte is not null then
    select profil into v_profil from compte where id_compte = new.id_compte;
    if not exists (
      select 1 from transition_commande_profil
       where code_depuis = v_courant and code_vers = new.code_statut and profil = v_profil
    ) then
      raise exception 'Profil % non habilite pour ce passage.', v_profil
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  v_total := fn_total_commande(new.id_commande);
  v_paye  := fn_paye_commande(new.id_commande);

  if new.code_statut = 'CONFIRMEE' then
    select coalesce((select valeur::numeric from parametre where cle = 'acompte_minimum'), 50)
      into v_minimum;
    if v_paye * 100 < v_total * v_minimum then
      raise exception 'Acompte insuffisant : % Ar verses sur % Ar attendus.',
        trunc(v_paye), trunc(v_total * v_minimum / 100) using errcode = 'check_violation';
    end if;
  end if;

  if new.code_statut = 'LIVREE' then
    v_reste := v_total - v_paye;
    if v_reste > 0 then
      raise exception 'Solde restant : % Ar.', trunc(v_reste) using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_chk_transition before insert on commande_statut
  for each row execute function fn_chk_transition();

-- Une commande confirmee ne se recompose plus : la decision prise porte sur
-- ce qui y figurait.
create or replace function fn_chk_ligne() returns trigger as $$
declare
  v_commande integer;
  v_courant  varchar(20);
begin
  v_commande := coalesce(new.id_commande, old.id_commande);
  select fn_statut_courant(v_commande) into v_courant;
  if v_courant is not null
     and not exists (select 1 from statut_commande where code = v_courant and est_initial) then
    raise exception 'Commande au statut % : ses articles ne changent plus.', v_courant
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_chk_ligne before insert or update or delete on commande_ligne
  for each row execute function fn_chk_ligne();

-- On n'encaisse pas plus que le du, ni sur une commande annulee.
create or replace function fn_chk_paiement() returns trigger as $$
declare
  v_courant varchar(20);
  v_total   numeric;
  v_paye    numeric;
begin
  select fn_statut_courant(new.id_commande) into v_courant;
  if v_courant = 'ANNULEE' then
    raise exception 'Commande annulee : aucun encaissement.' using errcode = 'check_violation';
  end if;

  if new.etat = 1 then
    v_total := fn_total_commande(new.id_commande);
    v_paye  := coalesce((select sum(montant) from paiement
                          where id_commande = new.id_commande and etat = 1
                            and id_paiement is distinct from new.id_paiement), 0);
    if v_paye + new.montant > v_total then
      raise exception 'Reste a payer : % Ar.', trunc(v_total - v_paye)
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_chk_paiement before insert or update on paiement
  for each row execute function fn_chk_paiement();

-- On ne note que ce qu'on a recu.
create or replace function fn_chk_avis() returns trigger as $$
begin
  if not exists (
    select 1
      from commande c
      join commande_ligne l on l.id_commande = c.id_commande
     where c.id_compte = new.id_compte
       and c.etat = 1
       and l.id_produit = new.id_produit
       and fn_statut_courant(c.id_commande) = 'LIVREE'
  ) then
    raise exception 'Article non recu : aucun avis.' using errcode = 'check_violation';
  end if;
  new.maj_le := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_chk_avis before insert or update on avis
  for each row execute function fn_chk_avis();


-- ===========================================================================
-- Vues
-- ===========================================================================

create view v_commande_statut as
select distinct on (cs.id_commande)
       cs.id_commande,
       cs.code_statut,
       s.libelle      as statut_libelle,
       s.ton          as statut_ton,
       s.ordre        as statut_ordre,
       s.est_final,
       cs.date_statut,
       cs.id_compte   as id_compte_statut
  from commande_statut cs
  join statut_commande s on s.code = cs.code_statut
 order by cs.id_commande, cs.date_statut desc, cs.id_commande_statut desc;

-- Ce que la boutique attend se lit ici, et nulle part ailleurs : une commande
-- annulee ne doit rien, meme si elle porte des articles.
create view v_commande as
select c.id_commande,
       c.reference,
       c.id_compte,
       c.remarque,
       c.cree_le,
       c.etat,
       c.supprime_le,
       cl.nom, cl.prenom, cl.etu, cl.promotion, cl.telephone,
       cl.prenom || ' ' || cl.nom          as client,
       st.code_statut, st.statut_libelle, st.statut_ton, st.statut_ordre,
       st.est_final, st.date_statut,
       coalesce(l.total, 0)                as total,
       coalesce(l.nb_articles, 0)          as nb_articles,
       coalesce(l.nb_lignes, 0)            as nb_lignes,
       coalesce(p.paye, 0)                 as paye,
       case when st.code_statut = 'ANNULEE' then 0
            else coalesce(l.total, 0) - coalesce(p.paye, 0) end as reste_a_payer,
       case when coalesce(l.total, 0) = 0 then 0
            else round(coalesce(p.paye, 0) * 100 / l.total) end  as taux_paiement,
       p.dernier_paiement
  from commande c
  join compte cl on cl.id_compte = c.id_compte
  left join v_commande_statut st on st.id_commande = c.id_commande
  left join lateral (
       select sum(quantite * prix_unitaire) as total,
              sum(quantite)                 as nb_articles,
              count(*)                      as nb_lignes
         from commande_ligne where id_commande = c.id_commande
  ) l on true
  left join lateral (
       select sum(montant) as paye, max(date_paiement) as dernier_paiement
         from paiement where id_commande = c.id_commande and etat = 1
  ) p on true;

create view v_produit as
select p.id_produit,
       p.reference,
       p.nom,
       p.description,
       p.prix,
       p.couleur,
       p.image,
       p.etat,
       p.cree_le,
       p.supprime_le,
       p.id_categorie,
       cat.code    as categorie_code,
       cat.libelle as categorie,
       coalesce(a.note_moyenne, 0) as note_moyenne,
       coalesce(a.nb_avis, 0)      as nb_avis,
       coalesce(v.nb_vendus, 0)    as nb_vendus,
       coalesce(t.tailles, '')     as tailles
  from produit p
  join categorie cat on cat.id_categorie = p.id_categorie
  left join lateral (
       select round(avg(note)::numeric, 1) as note_moyenne, count(*) as nb_avis
         from avis where id_produit = p.id_produit and etat = 1
  ) a on true
  left join lateral (
       select sum(l.quantite) as nb_vendus
         from commande_ligne l
         join commande c on c.id_commande = l.id_commande and c.etat = 1
        where l.id_produit = p.id_produit
  ) v on true
  left join lateral (
       select string_agg(t.code, ' ' order by t.ordre) as tailles
         from produit_taille pt join taille t on t.id_taille = pt.id_taille
        where pt.id_produit = p.id_produit and t.etat = 1
  ) t on true;

create view v_avis as
select a.id_avis, a.id_produit, a.id_compte, a.note, a.commentaire,
       a.cree_le, a.maj_le, a.etat, a.supprime_le,
       p.nom as produit, p.reference as produit_reference,
       c.prenom || ' ' || c.nom as client, c.promotion, c.etu
  from avis a
  join produit p on p.id_produit = a.id_produit
  join compte  c on c.id_compte  = a.id_compte;

-- La corbeille : tout ce qui porte etat = 0, a plat, avec de quoi le retrouver
-- et le remettre en service.
create view v_corbeille as
select 'produit'::text as type, 'Article'::text as type_libelle,
       p.id_produit as id, p.reference as code, p.nom as libelle,
       p.supprime_le, p.supprime_par
  from produit p where p.etat = 0
union all
select 'categorie', 'Categorie', c.id_categorie, c.code, c.libelle, c.supprime_le, c.supprime_par
  from categorie c where c.etat = 0
union all
select 'compte', 'Compte', c.id_compte, c.etu, c.prenom || ' ' || c.nom, c.supprime_le, c.supprime_par
  from compte c where c.etat = 0
union all
select 'commande', 'Commande', c.id_commande, c.reference, cl.prenom || ' ' || cl.nom,
       c.supprime_le, c.supprime_par
  from commande c join compte cl on cl.id_compte = c.id_compte where c.etat = 0
union all
select 'paiement', 'Encaissement', p.id_paiement, c.reference,
       trunc(p.montant)::text || ' Ar', p.supprime_le, p.supprime_par
  from paiement p join commande c on c.id_commande = p.id_commande where p.etat = 0
union all
select 'avis', 'Avis', a.id_avis, p.reference,
       a.note::text || '/5 · ' || p.nom, a.supprime_le, a.supprime_par
  from avis a join produit p on p.id_produit = a.id_produit
 where a.etat = 0;


-- ===========================================================================
-- Remise a zero
--
-- Ce que le bouton « Reinitialiser la base » de la console appelle, et ce par
-- quoi commence sql/jeu_demonstration.sql : apres son passage, la base est
-- celle que donne ce fichier joue seul — le parametrage, les tailles, le cycle
-- de vie, et le seul compte passe en argument.
--
-- Unique endroit du projet ou l'on efface vraiment des lignes : partout
-- ailleurs la suppression est logique (etat = 0) et la corbeille rattrape. Ici
-- on repart de zero, la corbeille comprise.
-- ===========================================================================

create or replace function fn_reinitialiser(p_compte integer) returns void as $$
declare
  v_profil varchar(20);
begin
  select profil into v_profil
    from compte where id_compte = p_compte and etat = 1;
  if v_profil is distinct from 'ADMIN' then
    raise exception 'Reinitialisation reservee a un administrateur en service.'
      using errcode = 'check_violation';
  end if;

  -- L'ORDRE COMPTE. trg_chk_ligne refuse qu'on touche aux articles d'une
  -- commande qui a quitte son statut initial : en vidant commande_statut
  -- d'abord, fn_statut_courant ne renvoie plus rien et le declencheur laisse
  -- passer. Sans cela il faudrait le desactiver, ce qui demande des droits
  -- qu'on n'a pas sur une base hebergee.
  delete from avis;
  delete from paiement;
  delete from commande_statut;
  delete from commande_ligne;
  delete from commande;
  delete from produit_image;
  delete from produit_taille;
  delete from produit;
  delete from categorie;
  delete from compte where id_compte <> p_compte;

  -- Les references repartent de CMD-26-0001 et ART-0001 : une base vierge qui
  -- numerote a partir de 48 n'est pas vierge pour celui qui la lit.
  perform setval('seq_reference_commande', 1, false);
  perform setval('seq_reference_produit',  1, false);
  perform setval(pg_get_serial_sequence('categorie', 'id_categorie'), 1, false);
  perform setval(pg_get_serial_sequence('produit',   'id_produit'),   1, false);
  perform setval(pg_get_serial_sequence('commande',  'id_commande'),  1, false);
  perform setval(pg_get_serial_sequence('commande_ligne',  'id_ligne'),  1, false);
  perform setval(pg_get_serial_sequence('commande_statut', 'id_commande_statut'), 1, false);
  perform setval(pg_get_serial_sequence('paiement', 'id_paiement'), 1, false);
  perform setval(pg_get_serial_sequence('avis',     'id_avis'),     1, false);
  perform setval(pg_get_serial_sequence('compte',   'id_compte'), p_compte + 1, false);
end;
$$ language plpgsql;


-- ===========================================================================
-- Donnees de parametrage
-- ===========================================================================

insert into parametre (cle, valeur, libelle) values
  ('acompte_minimum', '50', 'Part de la commande a verser pour la confirmer (%)'),
  ('contact_telephone', '+261 34 00 000 00', 'Telephone affiche sur la boutique'),
  ('contact_lieu', 'Campus ITU, Antananarivo', 'Lieu de retrait affiche sur la boutique');

insert into statut_commande (code, libelle, ordre, est_initial, est_final, ton) values
  ('NOUVELLE',       'Nouvelle',        1, true,  false, 'info'),
  ('CONFIRMEE',      'Confirmée',       2, false, false, 'info'),
  ('EN_PREPARATION', 'En préparation',  3, false, false, 'warn'),
  ('PRETE',          'Prête',           4, false, false, 'warn'),
  ('LIVREE',         'Livrée',          5, false, true,  'ok'),
  ('ANNULEE',        'Annulée',         6, false, true,  'danger');

insert into transition_commande (code_depuis, code_vers, libelle) values
  ('NOUVELLE',       'CONFIRMEE',      'Confirmer'),
  ('NOUVELLE',       'ANNULEE',        'Annuler'),
  ('CONFIRMEE',      'EN_PREPARATION', 'Lancer la préparation'),
  ('CONFIRMEE',      'ANNULEE',        'Annuler'),
  ('EN_PREPARATION', 'PRETE',          'Marquer prête'),
  ('EN_PREPARATION', 'ANNULEE',        'Annuler'),
  ('PRETE',          'LIVREE',         'Marquer livrée'),
  ('PRETE',          'ANNULEE',        'Annuler');

-- Le client annule tant que rien n'est lance ; le reste est au guichet.
insert into transition_commande_profil (code_depuis, code_vers, profil) values
  ('NOUVELLE',       'CONFIRMEE',      'GESTIONNAIRE'),
  ('NOUVELLE',       'CONFIRMEE',      'ADMIN'),
  ('NOUVELLE',       'ANNULEE',        'CLIENT'),
  ('NOUVELLE',       'ANNULEE',        'GESTIONNAIRE'),
  ('NOUVELLE',       'ANNULEE',        'ADMIN'),
  ('CONFIRMEE',      'EN_PREPARATION', 'GESTIONNAIRE'),
  ('CONFIRMEE',      'EN_PREPARATION', 'ADMIN'),
  ('CONFIRMEE',      'ANNULEE',        'ADMIN'),
  ('EN_PREPARATION', 'PRETE',          'GESTIONNAIRE'),
  ('EN_PREPARATION', 'PRETE',          'ADMIN'),
  ('EN_PREPARATION', 'ANNULEE',        'ADMIN'),
  ('PRETE',          'LIVREE',         'GESTIONNAIRE'),
  ('PRETE',          'LIVREE',         'ADMIN'),
  ('PRETE',          'ANNULEE',        'ADMIN');

insert into mode_paiement (code, libelle, ordre) values
  ('ESPECES',      'Espèces',       1),
  ('MVOLA',        'MVola',         2),
  ('ORANGE_MONEY', 'Orange Money',  3),
  ('AIRTEL_MONEY', 'Airtel Money',  4),
  ('VIREMENT',     'Virement',      5);

insert into taille (code, libelle, ordre) values
  ('XS',  'XS',             1),
  ('S',   'S',              2),
  ('M',   'M',              3),
  ('L',   'L',              4),
  ('XL',  'XL',             5),
  ('XXL', 'XXL',            6),
  ('TU',  'Taille unique',  7);


-- ===========================================================================
-- Compte d'amorcage
--
-- Un seul compte a la livraison : ADMIN / « itu2026 ». Tout le reste —
-- categories, articles, comptes du bureau et des etudiants — s'ouvre depuis la
-- console. C'est l'etat que redonne « Reinitialiser la base » (Parametrage >
-- Parametres), et celui qu'on retrouve en rejouant ce seul fichier.
--
-- L'empreinte est calculee par la base (pgcrypto, bcrypt cout 10) : le mot de
-- passe en clair ne sort pas de ce fichier, et aucune empreinte n'y est
-- recopiee a la main.
-- ===========================================================================

insert into compte (etu, nom, prenom, promotion, telephone, mot_de_passe, profil) values
  ('ADMIN', 'ITU Motor Society', 'Bureau', 'Bureau', '+261 34 00 000 00',
   crypt('itu2026', gen_salt('bf', 10)), 'ADMIN');
