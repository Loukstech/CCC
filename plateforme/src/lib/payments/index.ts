import "server-only";

export type CheckoutInput = {
  orderId: string;
  amount: number; // plus petite unité de la devise
  currency: string;
  description: string;
  customer: { name: string | null; email: string | null };
};

export type CheckoutResult = {
  /** Page de paiement vers laquelle envoyer l'utilisateur. */
  redirectUrl: string;
  providerRef: string;
};

/**
 * Un prestataire de paiement. Le reste du site ne connaît que cette interface : brancher FedaPay, CinetPay ou
 * Stripe revient à écrire un nouvel adaptateur et à changer PAYMENT_PROVIDER.
 */
export interface PaymentProvider {
  id: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
}

/** Paiement de démonstration : aucune somme réelle, l'utilisateur choisit lui-même « payé » ou « échec ». */
const demo: PaymentProvider = {
  id: "demo",
  async createCheckout({ orderId }) {
    return { redirectUrl: `/paiement/demo/${orderId}`, providerRef: `demo_${orderId}` };
  },
};

const PROVIDERS: Record<string, PaymentProvider> = { demo };

/**
 * La page de paiement simulée est-elle accessible ?
 *
 * Oui par défaut : c'est ce qui permet de dérouler tout le parcours (achat → commissions → versement)
 * tant qu'aucun prestataire réel n'est branché. Mettre DEMO_PAYMENT_VISIBLE=false pour la fermer,
 * par exemple le jour où le site est montré avec un vrai prestataire.
 */
export const demoCheckoutVisible = process.env.DEMO_PAYMENT_VISIBLE !== "false";

export function getPaymentProvider(): PaymentProvider {
  const id = process.env.PAYMENT_PROVIDER ?? "demo";
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Prestataire de paiement inconnu : ${id}`);
  return provider;
}

export const getProviderById = (id: string | null) => (id ? PROVIDERS[id] : undefined);
