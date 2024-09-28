const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

let cachedResult = { domTree: null, inputUrl: '' };

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index', {
    domTree: null,
    inputUrl: '',
    error: null
  });
});

app.post('/', async (req, res) => {
  const inputUrl = req.body.url;
  let domTree = {};

  try {
    const { data: html } = await axios.get(inputUrl, { timeout: 10000 });
    const $ = cheerio.load(html);

    $.root().children().each((_, el) => {
      if (el.type === 'tag' || el.type === 'script' || el.type === 'style') {
        buildDomTree($(el), domTree);
      }
    });

    cachedResult = { domTree, inputUrl };
    res.render('index', { domTree, inputUrl, error: null });
  } catch (err) {
    res.render('index', { domTree: null, inputUrl, error: err.message });
  }
});

app.get('/export-json', (req, res) => {
  if (!cachedResult.domTree) return res.json({});
  let result = {};
  collectSelectors(cachedResult.domTree, result);
  res.json(result);
});

function buildDomTree($el, tree) {
  const tagName = $el[0].name.toLowerCase();
  const classAttr = $el.attr('class') || '';
  const classes = classAttr.split(/\s+/).filter(Boolean).sort().join('.');
  const selectorKey = classes ? `${tagName}.${classes}` : tagName;

  if (!tree[selectorKey]) {
    tree[selectorKey] = { count: 0, children: {} };
  }
  tree[selectorKey].count++;

  $el.children().each((_, child) => {
    if (child.type === 'tag' || child.type === 'script' || child.type === 'style') {
      buildDomTree($el.find(child), tree[selectorKey].children);
    }
  });
}

function collectSelectors(tree, result) {
  Object.keys(tree).forEach(key => {
    if (!result[key]) result[key] = 0;
    result[key] += tree[key].count;
    if (tree[key].children) {
      collectSelectors(tree[key].children, result);
    }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});