import {expect} from 'chai'
import {launch, Page} from 'puppeteer'
import * as engine from '../src/engine';
import {readFileSync} from 'fs'
import {AtomicStyleRule, AtomicStyle} from 'src/cssUtils'

const create = engine.create
const createStyleResolver = engine.createStyleResolver

describe('Engine', () => {
    let browser = null;
    let page : Page = null;
    before(async() => browser = await launch())
    beforeEach(async () => {
        page = await browser.newPage();
        page.on('console', (e, args) => console[e['_type']](e['_text']))
        await page.addScriptTag({path: 'dist/engine.js'})
    });

    afterEach(() => page.close())
    after(() => browser.close())

    it('should register and resolve a simple rule', async() => {
        await page.setContent(`
            <body>
                <div id="test" data-style="height: three-pixels"></div>
            </body>
        `)
        const height = await page.evaluate(() => {
            const proc = createStyleResolver({
                match: (styleRule : AtomicStyleRule) =>  styleRule.value === 'three-pixels',
                resolve: (AtomicStyle : AtomicStyle, element: HTMLElement) => (Object.keys(AtomicStyle).reduce((style, key) => ({[key] : AtomicStyle[key] === 'three-pixels' ? '3px' : AtomicStyle[key],  ...style}), {}))
            })
            
            create(document.documentElement).run([proc])
            return (<HTMLElement>document.querySelector('#test')).offsetHeight
        });

        expect(height).to.equal(3)
    })

})