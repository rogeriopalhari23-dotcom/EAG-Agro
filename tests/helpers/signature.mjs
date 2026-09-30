// Assinatura de teste já conferida, para testes de unidade que não passam por setup() (a real depende do logo original
// e da conferência visual de Rogério; ver src/templates/assinatura.js).
import { SIGNATURE } from "../../src/templates/assinatura.js";
export const TEST_SIGNATURE_HTML = '<table id="assinatura-teste"><tr><td>Rogerio Palhari</td></tr></table>';
Object.assign(SIGNATURE, { status: "confirmed", html: TEST_SIGNATURE_HTML });
