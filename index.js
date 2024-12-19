const puppeteer = require("puppeteer");
const fs = require("fs");

// Generate array of URLs for each month since Jan 2022
function generateMonthlyUrls() {
  const urls = [];
  const startDate = new Date(2022, 0); // Jan 2022
  const currentDate = new Date();

  for (let d = startDate; d <= currentDate; d.setMonth(d.getMonth() + 1)) {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString();
    urls.push(`https://www.theverge.com/archives/${year}/${month}`);
  }
  return urls;
}

async function scrapeArticles() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  let allArticles = [];

  const monthlyUrls = generateMonthlyUrls();

  for (const url of monthlyUrls) {
    console.log(`Scraping: ${url}`);
    await page.goto(url);

    // Keep clicking "Load More" until no more articles
    while (true) {
      try {
        await page.waitForSelector(".c-archives-load-more__button", {
          timeout: 5000,
        });
        await page.click(".c-archives-load-more__button");
        await page.waitForTimeout(1000); // Wait for new content to load
      } catch {
        break; // No more "Load More" button found
      }
    }

    // Extract article data
    const articles = await page.evaluate(() => {
      const items = [];
      document
        .querySelectorAll(".c-entry-box--compact__body")
        .forEach((element) => {
          items.push({
            title: element
              .querySelector(".c-entry-box--compact__title")
              .innerText.trim(),
            url: element.querySelector("a").href,
            date: element.querySelector("time")?.getAttribute("datetime"),
          });
        });
      return items;
    });

    allArticles = [...allArticles, ...articles];
  }

  // Sort articles by date (newest first)
  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Generate HTML file
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>The Verge Articles Since 2022</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          a { color: #333; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .article { margin-bottom: 15px; }
          .date { color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <h1>The Verge Articles Since 2022</h1>
        ${allArticles
          .map(
            (article) => `
          <div class="article">
            <a href="${article.url}">${article.title}</a>
            <div class="date">${new Date(
              article.date
            ).toLocaleDateString()}</div>
          </div>
        `
          )
          .join("")}
      </body>
    </html>
  `;

  fs.writeFileSync("articles.html", html);
  fs.writeFileSync("articles.json", JSON.stringify(allArticles, null, 2));

  await browser.close();
  console.log(`Scraped ${allArticles.length} articles`);
}

scrapeArticles();
