import fs from 'fs';
import got from 'got';
import path from 'path';
import cheerio from 'cheerio';

export const getUser = async (username, playmode = 'std', includeSkills = false) => {
	if (username == '@example') {
		const filePath = path.join(process.cwd(), `/assets/example/user.json`);	
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	}
	const playmodes = {
		std: 'osu',
		taiko: 'taiko',
		catch: 'fruits',
		mania: 'mania',
	}
	if (!playmodes[playmode]){
		return {
			error: `Invalid playmode ${playmode}`
		}
	}
	let response;
	try {
		response = await got({
			method: 'get',
			url: `https://osu.ppy.sh/users/${username}/${playmodes[playmode]}`,
		});	
	} catch (error) {
		if (error.response.statusCode === 404){
			return {
				error: `User ${username} not found`
			}
		}
		return {
			error: `Unknown Error`
		}
	}
	
    const body = response.body;
	let $ = cheerio.load(body);
	const data = JSON.parse($('.js-react--profile-page.osu-layout').attr('data-initial-data'));
	data.current_mode = playmode;

	if (includeSkills) {
		data.user.skills = await getUserOsuSkills(username);
	}

	return data;
}
export const getImage = async (url) => {
	if (url.startsWith('example_')){
		const filePath = path.join(process.cwd(), `/assets/example/${url}`);
		return Buffer.from(fs.readFileSync(filePath));
	}
	const response = await got({
		method: 'get',
		responseType: 'buffer',
		url,
	});
	return response.body;
}
export const getImageBase64 = async (url) => {
	if (url.startsWith('example_')){
		const filePath = path.join(process.cwd(), `/assets/example/${url}`);
		return "data:image/png;base64," + Buffer.from(fs.readFileSync(filePath)).toString('base64');
	}
	const response = await got({
		method: 'get',
		responseType: 'buffer',
		url,
	});
	return "data:image/png;base64," + Buffer.from(response.body).toString('base64');
}
export const getUserOsuSkills = async (username) => {
	const calcSingleSkill = (value, globalRank, countryRank) => {
		value = parseInt(value);
		globalRank = parseInt(globalRank);
		countryRank = parseInt(countryRank);
		return {
			"value": value,
			"globalRank": globalRank,
			"countryRank": countryRank,
			"percent": Math.min(value / 1000 * 100, 100)
		}
	}
	let response;
	try {
		response = await got({
			method: 'get',
			url: `https://osuskills.com/user/${username}`,
		});	
	} catch (error) {
		return {
			error: `Failed to get skills data`
		}
	}
	const body = response.body;

	try {
		let $ = cheerio.load(body);
		const values = $('.skillsList .skillValue');
		const globalRanks = $('#ranks .skillTop .world');
		const countryRanks = $('#ranks .skillTop .country');
		const names = ["stamina", "tenacity", "agility", "accuracy", "precision", "reaction", "memory"];
		let result = {skills: {}, tags: []};
		for (let i = 0; i <= 6; i++){
			result.skills[names[i]] = calcSingleSkill(
				values[i].children[0].data,
				globalRanks[i].children[0].data.substring(1),
				countryRanks[i].children[0].data.substring(1)
			);
		}

		const tags = $('.userRank .userRankTitle');
		for (let i of tags){
			result.tags.push(i.children[0].data.trim());
		}

		return result;
	} catch (error) {
		return null;
	}
}