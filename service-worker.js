/**
 * eplus-next Service Worker (legacy ~/dev/eplus/public/static/service-worker.js 準拠)。
 *
 *   - scope は register 側で `/epl/tickets/` に絞る (dashboard 側では SW を起動しない)
 *   - install で静的アセットを precache
 *   - fetch で cache-first (fallback = network)
 *   - HTML / API / D1 (dynamic response) は cache しない (常に network)
 *
 * legacy と違って astro asset は hash 化されるので特定ファイル名列挙は行わず、
 * `/epl/image/`, `/epl/font/`, `/epl/lottie/`, `/epl/lottie-web/`, `/icon/` の GET のみ cache する。
 */
const CACHE_NAME = 'eplus-next-static-v1';

// 起動時 precache 対象 (よく使う 14 フレーム PNG + フォント + Lottie player + icon)
const PRECACHE = [
	'/manifest.json',
	// フォント
	'/epl/font/sf_pro_text_thin.ttf',
	'/epl/font/sf_pro_text_light.ttf',
	'/epl/font/sf_pro_text_regular.ttf',
	'/epl/font/sf_pro_text_medium.ttf',
	'/epl/font/sf_pro_text_semibold.ttf',
	'/epl/font/sf_pro_text_bold.ttf',
	// Lottie player (self-host)
	'/epl/lottie-web/lottie.min.js',
	// 「入場する」14 フレーム
	'/epl/image/edsdk_btn_goto_gatepass_01.png',
	'/epl/image/edsdk_btn_goto_gatepass_02.png',
	'/epl/image/edsdk_btn_goto_gatepass_03.png',
	'/epl/image/edsdk_btn_goto_gatepass_04.png',
	'/epl/image/edsdk_btn_goto_gatepass_05.png',
	'/epl/image/edsdk_btn_goto_gatepass_06.png',
	'/epl/image/edsdk_btn_goto_gatepass_07.png',
	'/epl/image/edsdk_btn_goto_gatepass_08.png',
	'/epl/image/edsdk_btn_goto_gatepass_09.png',
	'/epl/image/edsdk_btn_goto_gatepass_10.png',
	'/epl/image/edsdk_btn_goto_gatepass_11.png',
	'/epl/image/edsdk_btn_goto_gatepass_12.png',
	'/epl/image/edsdk_btn_goto_gatepass_13.png',
	'/epl/image/edsdk_btn_goto_gatepass_14.png',
	// もぎり関連スプライト
	'/epl/image/edsdk_v3_icon_ticket_gatepass.png',
	'/epl/image/edsdk_v3_st_ticket_used_stamp.png',
	'/epl/image/edsdk_v3_icon_gate.png',
	'/epl/image/edsdk_v3_icon_gate_star.png',
	'/epl/image/edsdk_ic_distribution_button.png',
	// icon
	'/icon/apple-touch-icon.png',
	'/icon/favicon-32x32.png',
	'/icon/favicon-16x16.png',
	'/icon/android-chrome-192x192.png',
	'/icon/android-chrome-512x512.png',
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) =>
			// 個別 add で 1 個失敗しても他を続行 (addAll は 1 失敗で全失敗するため使わない)
			Promise.all(
				PRECACHE.map((url) =>
					cache.add(url).catch((err) => {
						console.warn('[sw] precache miss:', url, err?.message ?? err);
					}),
				),
			),
		),
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))),
		),
	);
	self.clients.claim();
});

// cache-eligible: 静的 GET のみ (SSR HTML / API / query は避ける)
function isCacheable(request) {
	if (request.method !== 'GET') return false;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return false;
	if (url.search) return false; // ?forceReload=... 等は bypass
	if (
		url.pathname.startsWith('/epl/image/') ||
		url.pathname.startsWith('/epl/font/') ||
		url.pathname.startsWith('/epl/lottie/') ||
		url.pathname.startsWith('/epl/lottie-web/') ||
		url.pathname.startsWith('/icon/') ||
		url.pathname.startsWith('/svg/') ||
		url.pathname.startsWith('/epl/_astro/') ||   // Astro build 済 CSS/JS (hash 化済)
		url.pathname === '/manifest.json'
	) {
		return true;
	}
	return false;
}

self.addEventListener('fetch', (event) => {
	if (!isCacheable(event.request)) return; // 通常 fetch に任せる
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request).then((res) => {
				if (res && res.ok && res.type !== 'opaque') {
					const clone = res.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return res;
			});
		}),
	);
});
