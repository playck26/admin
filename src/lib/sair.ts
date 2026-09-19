import { clearAccessToken } from "./auth-storage";
import { desinscreverNoLogout } from "./push-do-navegador";

/**
 * SPEC-062/D2a — **sair da conta, incluindo o aparelho.**
 *
 * O logout do Admin é local: não há rota de servidor a chamar, só
 * `clearAccessToken()` e o redirecionamento. Mesmo assim a desinscrição mora
 * junto, e pela mesma razão do Cliente: **desinscrever e sair são duas metades
 * de uma decisão só**. Separadas, é questão de tempo até alguém aplicar uma
 * sem a outra.
 *
 * **A ordem importa, e aqui ela importa mais que no Cliente:** o
 * `DELETE /push/assinatura` precisa do token, e `clearAccessToken()` o apaga.
 * Invertido, a linha ficaria no banco até o primeiro `410`.
 *
 * **Melhor-esforço declarado.** A garantia de posse do aparelho não mora aqui
 * — mora na reconciliação, que roda ao abrir o painel (D2a-1).
 */
export async function sairDaConta(): Promise<void> {
  await desinscreverNoLogout();
  clearAccessToken();
}
