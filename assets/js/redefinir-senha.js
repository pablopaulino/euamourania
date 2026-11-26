import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const form = document.querySelector('#recovery');
const password = document.querySelector('#password');
const confirmation = document.querySelector('#confirmation');
const button = form.querySelector('button');
const instructions = document.querySelector('#instructions');
const feedback = document.querySelector('#feedback');
const hashes = new URLSearchParams(location.hash.slice(1)).getAll('token_hash');
let recoveryHash = hashes.length === 1 ? hashes[0] : '';
let accessToken = '';
const expired = 'Este link expirou ou já foi usado. Solicite outro em “Esqueci minha senha” e abra o e-mail mais recente.';

if (location.hash || location.search) history.replaceState(null, '', location.pathname);
if (recoveryHash) {
  form.hidden = false;
  instructions.textContent = 'Escolha uma senha com pelo menos 8 caracteres.';
}

async function authRequest(path, method, body) {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  return fetch(SUPABASE_URL + '/auth/v1/' + path, {
    method, headers, body: JSON.stringify(body), credentials: 'omit', redirect: 'error', cache: 'no-store',
  });
}

function finish(message) {
  recoveryHash = '';
  accessToken = '';
  form.reset();
  form.hidden = true;
  instructions.textContent = '';
  feedback.textContent = message;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled || form.hidden) return;
  if (password.value !== confirmation.value) {
    feedback.textContent = 'As senhas não conferem. Digite a mesma senha nos dois campos.';
    confirmation.focus();
    return;
  }

  const newPassword = password.value;
  button.disabled = true;
  feedback.textContent = 'Salvando…';
  try {
    // Only consume the one-time link when its recipient submits the form.
    if (!accessToken) {
      const response = await authRequest('verify', 'POST', { token_hash: recoveryHash, type: 'recovery' });
      if ([400, 401, 403, 422].includes(response.status)) return finish(expired);
      if (!response.ok) throw new Error();
      const session = await response.json();
      if (!session.access_token) return finish(expired);
      accessToken = session.access_token;
      recoveryHash = '';
    }
    const response = await authRequest('user', 'PUT', { password: newPassword });
    if (response.ok) return finish('Senha alterada. Você já pode entrar na sua conta com a nova senha.');
    if (response.status === 401 || response.status === 403) return finish(expired);
    const error = await response.json();
    if (error.code === 'same_password' || error.error_code === 'same_password') {
      feedback.textContent = 'Escolha uma senha diferente da atual.';
    } else if (response.status === 422) {
      feedback.textContent = 'Escolha uma senha mais forte e tente novamente.';
    } else {
      throw new Error();
    }
  } catch {
    feedback.textContent = 'Não foi possível concluir agora. Confira a conexão e tente novamente.';
  } finally {
    button.disabled = false;
  }
});
