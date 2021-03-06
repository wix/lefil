import {expect} from 'chai'
import {launch, Page} from 'puppeteer'
import * as rawss from '../src/rawss';
import * as engine from '../src/engine';
import {AtomicStyleRule, AtomicStyle} from 'src/cssUtils'
import * as express from 'express'
const createStyleResolver = engine.createStyleResolver
const createRawss = rawss.createRawss
describe('Rawcss', () => {
    let browser = null;
    let page : Page = null;
    let app = null
    let server = null
    const port = 9987
    before(async() => {
        browser = await launch()
        app = express()
        app.use(express.static('test/fixtures'))
        server = app.listen(port)
    })

    beforeEach(async () => {
        page = await browser.newPage();
        await page.goto(`http://localhost:${port}/index.html`)
        page.on('console', (e, args) => console[e['_type']](e['_text']))
        await page.addScriptTag({path: 'dist/rawss.js'})
        await page.addScriptTag({path: 'dist/engine.js'})
    });

    afterEach(() => page.close())
    after(async () => {
        await browser.close();
        await new Promise(r => server.close(r))
    })


    it('should register and resolve a rule using once()', async() => {
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
            
            const rawss = createRawss(document.documentElement)
            rawss.add(proc)
            rawss.once()
            return (<HTMLElement>document.querySelector('#test')).offsetHeight
        });

        expect(height).to.equal(3)
    })

    it('should register and resolve a rule using start()', async() => {
        const height = await page.evaluate(() => {
            const proc = createStyleResolver({
                match: (styleRule : AtomicStyleRule) =>  styleRule.value === 'four-pixels',
                resolve: (AtomicStyle : AtomicStyle, element: HTMLElement) => (Object.keys(AtomicStyle).reduce((style, key) => ({[key] : AtomicStyle[key] === 'four-pixels' ? '4px' : AtomicStyle[key],  ...style}), {}))
            })
            
            const rawss = createRawss(document.documentElement)
            rawss.add(proc)
            rawss.start()
            document.body.innerHTML = '<div id="test" data-style="height: four-pixels"></div>'
            return new Promise(r => {
                requestAnimationFrame(() => {
                    r((<HTMLElement>document.querySelector('#test')).offsetHeight)
                })
            })
        });

        expect(height).to.equal(4)
    })

    it('should resolve several changes in a row', async() => {
        const height = await page.evaluate(() => {
            const proc = createStyleResolver({
                match: (styleRule : AtomicStyleRule) =>  styleRule.value === 'four-pixels',
                resolve: (AtomicStyle : AtomicStyle, element: HTMLElement) => (Object.keys(AtomicStyle).reduce((style, key) => ({[key] : AtomicStyle[key] === 'four-pixels' ? '4px' : AtomicStyle[key],  ...style}), {}))
            })
            
            const rawss = createRawss(document.documentElement)
            rawss.add(proc)
            rawss.start()
            document.body.innerHTML = '<div id="test" data-style="height: 100px"></div>'

            return new Promise(r => {
                requestAnimationFrame(() => {
                    document.getElementById('test').setAttribute('data-style', 'height: 100px; height: four-pixels')
                    requestAnimationFrame(() => {
                        r((<HTMLElement>document.querySelector('#test')).offsetHeight)
                    })
                })
            })
        });

        expect(height).to.equal(4)
    })

    it('should resolve styles from external stylesheets', async() => {
        await page.setContent('<head><style>#test { height: 30px; }</style><link rel="stylesheet" href="/test2.css" /></head><body />')
        const height = await page.evaluate(() => {
            const proc = createStyleResolver({
                match: (styleRule : AtomicStyleRule) =>  styleRule.value === 'four-pixels',
                resolve: (AtomicStyle : AtomicStyle, element: HTMLElement) => (Object.keys(AtomicStyle).reduce((style, key) => ({[key] : AtomicStyle[key] === 'four-pixels' ? '4px' : AtomicStyle[key],  ...style}), {}))
            })            
            
            const rawss = createRawss(document.documentElement)
            rawss.add(proc)
            rawss.start()
            document.body.innerHTML = '<div id="test"></div>'

            return rawss.settle().then(() => new Promise(r => {
                requestAnimationFrame(() => {
                    r((<HTMLElement>document.querySelector('#test')).offsetHeight)
                })
            }))
        });

        expect(height).to.equal(4)
    })

    it('should not resolve changes once pause() is called', async() => {
        const height = await page.evaluate(() => {
            const proc = createStyleResolver({
                match: (styleRule : AtomicStyleRule) =>  styleRule.value === 'four-pixels',
                resolve: (AtomicStyle : AtomicStyle, element: HTMLElement) => (Object.keys(AtomicStyle).reduce((style, key) => ({[key] : AtomicStyle[key] === 'four-pixels' ? '4px' : AtomicStyle[key],  ...style}), {}))
            })
            
            const rawss = createRawss(document.documentElement)
            rawss.add(proc)
            rawss.start()
            document.body.innerHTML = '<div id="test" data-style="height: 100px"></div>'

            return new Promise(r => {
                requestAnimationFrame(() => {
                    rawss.pause()
                    document.getElementById('test').setAttribute('style', 'height: 100px; height: four-pixels')
                    requestAnimationFrame(() => {
                        r((<HTMLElement>document.querySelector('#test')).offsetHeight)
                    })
                })
            })
        });

        expect(height).to.equal(100)
    })
})