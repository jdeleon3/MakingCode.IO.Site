// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'MakingCode';
export const SITE_URL = 'https://makingcode.io';

// Computed at build time so this never silently goes stale — see brand-brief.md §1.
export const CAREER_START_YEAR = 2012;
export const YEARS_IN_ENTERPRISE_SOFTWARE = new Date().getFullYear() - CAREER_START_YEAR;

export const SITE_DESCRIPTION =
  `Field notes from ${YEARS_IN_ENTERPRISE_SOFTWARE} years in enterprise software, now applied to AI/ML and business automation.`;

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