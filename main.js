const fs = require('fs');
const cheerio = require('cheerio');
const superagent = require('superagent');
const translate = require('translate');
const Progress = require('cli-progress');

const {themePageUrl, sortKey, outFileName} = require('./config');

translate.engine = 'google';
translate.key = 'AIzaSyAuPO3rl-CClveK6XulCapCITeSONanpVA';

let count = 0, progress;

/**
 * 获取 theme github 仓库信息
 * @param url
 * @param others
 * @returns {Promise.<*>}
 */
async function getReopData(url = '', others = {}) {
    const repoData = await superagent.get(url);

    const {req, res, error} = repoData;

    if (error) {
        debugger
        throw Error(repoData.error);
    }

    const $ = cheerio.load(res.text);

    const watch = $('a[aria-label~="watching"]').text().replace(/[\s|\,]/g, '');
    const star = $('a[aria-label~="starred"]').text().replace(/[\s|\,]/g, '');
    const fork = $('a[aria-label~="forked"]').text().replace(/[\s|\,]/g, '');

    progress.update(count++);

    return Object.assign(others, {watch, star, fork, url});
}

/**
 * data sort
 * @param sorData
 * @param sortKey
 * @returns {Array.<*>}
 */
function dataSort(sorData = [], sortKey) {
    return sorData.sort((pre, nex) => sortKey ? nex[sortKey] - pre[sortKey] : nex - pre)
}

superagent.get(themePageUrl).end((err, res) => {
    if (err) {
        throw Error(err);
    }

    let $ = cheerio.load(res.text), themes = [];

    Array.from($('li.plugin.on'), async (dom, i) => {
        await themes.push({
            name: $(dom).find('a.plugin-name').text(),
            preview: $(dom).find('a.plugin-preview-link')[0].attribs.href,
            repo: $(dom).find('a.plugin-name')[0].attribs.href,
            desc: $(dom).find('p.plugin-desc').text(),
            // cnDp: await translate($(dom).find('a.plugin-desc').text(), {to: 'zh'}),
            tags: $(dom).find('div.plugin-tag-list')[0].children.map(d => d.attribs && d.attribs.href.replace('#', '')).join('  ').trim()
        });
    });

    console.log(`Totally ${themes.length} themes ...`);

    progress = new Progress.Bar({
        format: 'progress: 【{bar}】 {percentage}% | {value}/{total} | {duration}s',
        hideCursor: true
    });

    progress.start(themes.length, 0);

    const allReopData = themes.map(theme => {
        return getReopData(theme.repo, theme);
    });

    Promise.all(allReopData.map(p => p.catch(e => e))).then(data => {
        progress.stop();
        let No = 1;
        const cache = [...data],
            outFile = fs.createWriteStream(`${outFileName}`, {encoding: 'utf8'});

        outFile.write(`${('No'.padStart(5))} ${'Name'.padEnd(20)} ${'Watch'.padEnd(8)} ${'Star'.padEnd(8)} ${'Fork'.padEnd(8)} ${'Repo'.padEnd(60)} ${'Preview'.padEnd(60)} Desc\n`);

        data = data.filter(theme => Object.keys(theme).includes(sortKey));

        data = dataSort(data, sortKey);

        data.map(theme => {
            const {name, watch, star, fork, preview, repo, desc, tags} = theme;
            const str = `${(No++).toString().padStart(5)} ${name.toString().padEnd(20)} ${watch.toString().padEnd(8)} ${star.toString().padEnd(8)} ${fork.toString().padEnd(8)} ${repo.toString().padEnd(60)} ${preview.toString().padEnd(60)} ${desc}\n`;
            outFile.write(str);
            console.log(str);
        });

        outFile.end();

        console.log(`Finished! All data has been output to ${outFileName.toUpperCase()}.`);

        fs.writeFileSync('source.json', JSON.stringify(cache, null, 4), 'utf-8');
    }).catch(err => console.log(err));
});
