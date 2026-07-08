// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'MakingCode';
export const SITE_DESCRIPTION =
  'Automated systems engineering for real estate brokerages and B2B operators.';
export const SITE_URL = 'https://makingcode.io';

export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/projects/', label: 'Projects' },
  { href: '/blog/', label: 'Blog' },
  { href: '/about/', label: 'About' },
];

export const CONTACT_PATH = '/contact/';