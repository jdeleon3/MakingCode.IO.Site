// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'MakingCode';
export const SITE_DESCRIPTION =
  'Build logs from 14 years in enterprise software, now applied to AI/ML and business automation.';
export const SITE_URL = 'https://makingcode.io';

export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/blog/', label: 'Blog' },
  { href: '/projects/', label: 'Projects' },
  { href: '/about/', label: 'About' },
  { href: '/work-with-me/', label: 'Work with me' },
];

export const CONTACT_PATH = '/contact/';
export const WORK_WITH_ME_PATH = '/work-with-me/';