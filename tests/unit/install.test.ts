import assert from "node:assert/strict";
import { test } from "node:test";
import { detectInstallPlatform } from "@/lib/install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone14,5; iOS 18_0; pt_BR)";
const IPHONE_WEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const ANDROID_SAMSUNG =
  "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
const ANDROID_FACEBOOK =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

test("detectInstallPlatform reconhece os navegadores do iPhone", () => {
  assert.equal(detectInstallPlatform(IPHONE_SAFARI, 5), "ios");
  assert.equal(detectInstallPlatform(IPHONE_CHROME, 5), "ios");
});

test("detectInstallPlatform trata o iPad que se apresenta como Mac", () => {
  assert.equal(detectInstallPlatform(MAC_SAFARI, 5), "ios");
});

test("detectInstallPlatform reconhece os navegadores do Android", () => {
  assert.equal(detectInstallPlatform(ANDROID_CHROME, 5), "android");
  assert.equal(detectInstallPlatform(ANDROID_SAMSUNG, 5), "android");
});

test("detectInstallPlatform separa o navegador embutido em outro app", () => {
  assert.equal(detectInstallPlatform(IPHONE_INSTAGRAM, 5), "in-app");
  assert.equal(detectInstallPlatform(IPHONE_WEBVIEW, 5), "in-app");
  assert.equal(detectInstallPlatform(ANDROID_FACEBOOK, 5), "in-app");
  assert.equal(detectInstallPlatform(ANDROID_WEBVIEW, 5), "in-app");
});

test("detectInstallPlatform ignora o computador", () => {
  assert.equal(detectInstallPlatform(MAC_SAFARI, 0), null);
  assert.equal(detectInstallPlatform(WINDOWS_CHROME, 0), null);
});
