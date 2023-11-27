const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const web_base_url = "https://entrackr.com/category/news";

console.log("⛵️⛵️⛵️⛵️⛵️ node_env: ", process.env.NODE_ENV);

const puppeteer_options = {
  headless: "new",

  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
};

const getData = async (website_url) => {
  let headings, images, authors, dates, links;
  const browser = await puppeteer.launch(puppeteer_options);
  const page = await browser.newPage();

  // Set viewport width and height
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(website_url, { waitUntil: "networkidle0" });

  headings = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".elementor-post.category-news .elementor-heading-title > a:not(.elementor-post.category-fintrackr .elementor-heading-title > a)"
    );
    return Array.from(elements).map((element) => element.textContent);
  });

  headings = headings.filter((element) => element !== "News");

  links = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".elementor-post.category-news .elementor-heading-title > a:not(.elementor-post.category-fintrackr .elementor-heading-title > a)"
    );
    return Array.from(elements).map((element) => {
      if (element.textContent !== "News") {
        return element.getAttribute("href");
      }
    });
  });

  links = links.filter((element) => element !== null);

  images = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".elementor-post.category-news .attachment-full"
    );
    return Array.from(elements).map((element) => element.src);
  });

  authors = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".elementor-post.category-news .elementor-post-info__item--type-author"
    );
    return Array.from(elements).map((element) => element.textContent);
  });

  dates = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".elementor-post.category-news .elementor-post-info__item--type-date"
    );
    return Array.from(elements).map((element) => element.textContent);
  });

  await browser.close();

  return { headings, images, authors, dates, links };
};

const getLastPageNumber = async (website_url) => {
  const browser = await puppeteer.launch(puppeteer_options);
  const page = await browser.newPage();

  // Set viewport width and height
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(website_url, { waitUntil: "networkidle0" });

  const pageNumbers = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".elementor-pagination > .page-numbers"
    );
    return Array.from(elements).map((element) => element.textContent);
  });
  console.log("🔥  file: index.js:100  pageNumbers: ", pageNumbers);

  await browser.close();

  return pageNumbers.at(-2)?.split("e")[1];
};

const getArticle = async (url) => {
  let heading, data;
  const browser = await puppeteer.launch(puppeteer_options);
  const page = await browser.newPage();

  // Set viewport width and height
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: "networkidle0" });

  heading = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".elementor-heading-title.elementor-size-default"
    );
    return Array.from(elements).map((element) => element.textContent);
  });
  heading = heading[0];

  // FIXME problem in paragraphs
  data = await page.evaluate(() => {
    const result = [];

    const divXPath =
      "/html/body/div[2]/div/section[1]/div/div/div[1]/div/div/div[3]/div/div/div/div/section/div/div/div/div/div/div[6]/div"; // Replace with the actual class or other identifier of your div
    const div = document.evaluate(
      divXPath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (div) {
      const children = div.children;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const item = {};

        if (child.tagName === "P") {
          item.type = "text";
          item.content = child.textContent.trim();
        } else if (child.tagName === "FIGURE") {
          const imgElement = child.querySelector("img");
          if (imgElement) {
            item.type = "image";
            item.src = imgElement.getAttribute("src");
          }
        }

        item.id = i + 1; // unique id to traverse over it

        result.push(item);
      }
    }

    return result;
  });

  await browser.close();

  return { heading, data };
};

app.get("/", async (req, res) => {
  const lastPageNumber = await getLastPageNumber(web_base_url);
  res.json({ lastPageNumber });
});

app.get("/page/:pageNumber", async (req, res) => {
  const { pageNumber } = req.params;
  const { headings, images, authors, dates, links } = await getData(
    `${web_base_url}/page/${pageNumber}`
  );

  const size = headings.length;
  const news = [];
  for (let i = 0; i < size; i++) {
    const obj = {
      id: pageNumber * 100 + (i + 1),
      heading: headings[i],
      imageSrc: images[i],
      author: authors[i]?.replace(/[\n\t]/g, ""),
      date: dates[i]?.replace(/[\n\t]/g, ""),
      link: links[i],
    };
    news.push(obj);
  }

  res.status(200).json({ news });
});

app.post("/article", async (req, res) => {
  const { url } = req.body;
  const { heading, data } = await getArticle(url);
  res.json({ heading, data });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, function () {
  console.log("Server started on port 4000");
});
