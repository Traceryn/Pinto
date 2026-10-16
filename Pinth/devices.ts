export interface DeviceProfile {
  agent: string;
  acceptLanguage: string;
  secChUa: string;
  secChUaMobile: string;
  secChUaPlatform: string;
}

interface ProfileSeed {
  agent: string;
  secChUa: string;
  mobile: string;
  platform: string;
}

const CHROME_126 =
  '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"';
const CHROME_125 =
  '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"';
const EDGE_126 =
  '"Chromium";v="126", "Microsoft Edge";v="126", "Not-A.Brand";v="99"';
const OPERA_111 = '"Chromium";v="125", "Opera";v="111", "Not-A.Brand";v="99"';
const FIREFOX_UA = "";
const SAFARI_UA = "";

const SEEDS: ProfileSeed[] = [
  {
    agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    secChUa: CHROME_126,
    mobile: "?0",
    platform: '"Windows"',
  },
  {
    agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    secChUa: CHROME_125,
    mobile: "?0",
    platform: '"macOS"',
  },
  {
    agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    secChUa: FIREFOX_UA,
    mobile: "?0",
    platform: '"Windows"',
  },
  {
    agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
    secChUa: FIREFOX_UA,
    mobile: "?0",
    platform: '"macOS"',
  },
  {
    agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    secChUa: EDGE_126,
    mobile: "?0",
    platform: '"Windows"',
  },
  {
    agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    secChUa: SAFARI_UA,
    mobile: "?0",
    platform: '"macOS"',
  },
  {
    agent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    secChUa: CHROME_126,
    mobile: "?0",
    platform: '"Linux"',
  },
  {
    agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0",
    secChUa: OPERA_111,
    mobile: "?0",
    platform: '"Windows"',
  },
  {
    agent:
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    secChUa: CHROME_126,
    mobile: "?1",
    platform: '"Android"',
  },
  {
    agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    secChUa: SAFARI_UA,
    mobile: "?1",
    platform: '"iOS"',
  },
];

const LOCALES: string[] = [
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9",
  "en-US,en;q=0.9,fr;q=0.8",
  "en-CA,en;q=0.9,fr;q=0.8",
  "pt-BR,pt;q=0.9,en;q=0.8",
  "es-ES,es;q=0.9,en;q=0.8",
  "fr-FR,fr;q=0.9,en;q=0.8",
  "de-DE,de;q=0.9,en;q=0.8",
];

export function randomDevice(): DeviceProfile {
  const seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
  const locale = LOCALES[Math.floor(Math.random() * LOCALES.length)];
  return {
    agent: seed.agent,
    acceptLanguage: locale,
    secChUa: seed.secChUa,
    secChUaMobile: seed.mobile,
    secChUaPlatform: seed.platform,
  };
}
