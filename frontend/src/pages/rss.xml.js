import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context) {
	const posts = await getCollection('blog');
	const projects = await getCollection('projects');
	
	const postItems = posts.map((post) => ({
		...post.data,
		link: `/blog/${post.id}/`,
	}));
	const projectItems = projects.map((project) => ({
		...project.data,
		link: `/projects/${project.id}/`,
	}));
	const allItems = [...postItems, ...projectItems];

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: allItems.map((item) => ({
			title: item.title,
			description: item.description,
			pubDate: item.pubDate,
			link: item.link,
		})),
		customData: `<language>en-us</language>`
	});
}
