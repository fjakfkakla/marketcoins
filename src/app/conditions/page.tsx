import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "objet",
    title: "1. Objet",
    body: [
      "Marketcoins (« la Plateforme ») est une interface permettant d'acheter et de vendre des parts sur des marchés de prédiction portant sur la performance de traders publics (« KOLs ») mesurée à partir de données blockchain publiques.",
      "Les présentes conditions régissent l'accès et l'utilisation de la Plateforme. En connectant un wallet ou en négociant, vous les acceptez sans réserve.",
    ],
  },
  {
    id: "eligibilite",
    title: "2. Éligibilité",
    body: [
      "Vous devez avoir au moins 18 ans et la capacité juridique de contracter.",
      "L'accès est interdit aux résidents des juridictions où les marchés de prédiction ou les paris en ligne sont prohibés ou soumis à licence que la Plateforme ne détient pas. Il vous appartient de vérifier la législation applicable dans votre pays de résidence.",
      "La Plateforme peut appliquer un blocage géographique et refuser l'accès à tout moment.",
    ],
  },
  {
    id: "non-custodial",
    title: "3. Nature non-custodiale",
    body: [
      "La Plateforme ne détient jamais vos fonds ni vos clés privées. Les dépôts, mises et retraits sont exécutés par des smart contracts sur la blockchain Solana que vous signez avec votre propre wallet.",
      "Vous êtes seul responsable de la sécurité de votre wallet, de votre phrase de récupération et de vos appareils. Aucune transaction signée ne peut être annulée.",
    ],
  },
  {
    id: "marches",
    title: "4. Fonctionnement des marchés",
    body: [
      "Chaque marché définit une question, une période, une liste de résultats possibles et une règle de résolution publiée avant l'ouverture. Cette règle fait foi.",
      "Les marchés fonctionnent en parimutuel : chaque mise, après frais, rejoint la cagnotte du résultat choisi. À la résolution, la cagnotte totale du marché est répartie entre les mises placées sur le résultat gagnant, au prorata de leur montant. Les mises sur les autres résultats sont perdues.",
      "Les cotes et gains affichés avant la clôture sont des estimations fondées sur la cagnotte au moment de la consultation. Le gain effectif dépend de la répartition finale de la cagnotte à la clôture et peut être inférieur ou supérieur à l'estimation.",
      "Les mises ferment à la date indiquée et sont définitives : elles ne peuvent être ni annulées ni revendues.",
      "Des frais de 2 % sont prélevés sur chaque mise. Les frais de réseau Solana restent à votre charge.",
    ],
  },
  {
    id: "resolution",
    title: "5. Résolution et contestation",
    body: [
      "Le résultat est proposé par le comité de résolution (multisignature) à partir des données on-chain publiques des wallets listés, puis soumis à une période de contestation de 24 heures.",
      "En cas d'égalité, de changement de wallet d'un KOL, d'indisponibilité des données ou de manipulation avérée, le marché est annulé et toutes les mises sont remboursées sans frais.",
      "Les décisions du comité de résolution, prises conformément à la règle publiée, sont définitives.",
    ],
  },
  {
    id: "risques",
    title: "6. Avertissement sur les risques",
    body: [
      "Négocier sur des marchés de prédiction comporte un risque de perte totale du capital engagé. Ne misez jamais plus que ce que vous pouvez vous permettre de perdre.",
      "Les KOLs listés ne sont ni affiliés ni partenaires de la Plateforme. Leur performance passée ne préjuge pas de leur performance future.",
      "Les smart contracts peuvent contenir des vulnérabilités. La Plateforme applique des plafonds de mise et fait auditer son code, sans garantie d'absence de faille.",
    ],
  },
  {
    id: "conduite",
    title: "7. Conduite interdite",
    body: [
      "Sont interdits : la manipulation de marché, l'utilisation d'informations privilégiées, la coordination avec un KOL listé pour influencer un résultat, l'utilisation de bots abusifs, le contournement d'un blocage géographique et toute activité illégale.",
      "La Plateforme peut geler l'accès à l'interface pour tout compte suspect. Les fonds restant dans les smart contracts demeurent retirables par leur propriétaire.",
    ],
  },
  {
    id: "confidentialite",
    title: "8. Confidentialité",
    body: [
      "La Plateforme ne collecte que les données strictement nécessaires : adresse publique du wallet, historique de transactions on-chain (par nature publiques), adresse email si vous choisissez la connexion par email, et données techniques de connexion.",
      "Aucune donnée n'est vendue à des tiers. Vous pouvez demander la suppression de vos données hors chaîne à tout moment.",
    ],
  },
  {
    id: "responsabilite",
    title: "9. Limitation de responsabilité",
    body: [
      "La Plateforme est fournie « en l'état ». Dans la limite permise par la loi, Marketcoins décline toute responsabilité pour les pertes résultant de l'utilisation de la Plateforme, d'une défaillance de la blockchain, d'un wallet tiers ou d'une source de données.",
    ],
  },
  {
    id: "modifications",
    title: "10. Modifications",
    body: [
      "Les présentes conditions peuvent être modifiées à tout moment. La version en vigueur est celle publiée sur cette page, avec sa date de mise à jour. La poursuite de l'utilisation vaut acceptation.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-28 md:self-start">
        <div className="card p-3">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted">Sommaire</div>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-cream-2 hover:text-ink">{s.title}</a>
          ))}
        </div>
      </aside>
      <article className="card p-6 md:p-10 fade-up">
        <h1 className="text-3xl font-bold">Conditions d&apos;utilisation</h1>
        <p className="mt-2 text-sm text-muted">Dernière mise à jour : 9 octobre 2026</p>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mt-8 scroll-mt-28">
            <h2 className="text-lg font-bold">{s.title}</h2>
            {s.body.map((p, i) => <p key={i} className="mt-2 text-sm leading-relaxed text-muted">{p}</p>)}
          </section>
        ))}
      </article>
    </div>
  );
}
