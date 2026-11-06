import assert from "node:assert/strict";
import { test } from "node:test";
import { isPushEndpoint } from "@/lib/push";

test("isPushEndpoint aceita os serviços de push dos navegadores", () => {
  assert.equal(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"), true);
  assert.equal(isPushEndpoint("https://web.push.apple.com/abc"), true);
  assert.equal(isPushEndpoint("https://wns2-bl2p.notify.windows.com/w/?token=abc"), true);
});

test("isPushEndpoint recusa endereços que o servidor não deve chamar", () => {
  assert.equal(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"), false);
  assert.equal(isPushEndpoint("https://localhost/abc"), false);
  assert.equal(isPushEndpoint("https://169.254.169.254/latest/meta-data"), false);
  assert.equal(isPushEndpoint("https://fcm.googleapis.com.evil.example/abc"), false);
  assert.equal(isPushEndpoint("https://evilfcm.googleapis.com.example/abc"), false);
  assert.equal(isPushEndpoint("isso não é endereço"), false);
});
