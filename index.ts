import puppeteer from 'puppeteer';
import chalk from 'chalk';
import readline from 'readline-sync';
import fs from 'fs/promises';
import { parse as parseCsv } from 'csv-parse/sync';

// assuming the CSV file is structured as { frontFaceName, isFoil, variant, extraVariant, mtgmintcardUrl }

const fileName = readline.question('Please enter the CSV file name: ');

(async () => {
  try {
    const csvString = await fs.readFile(
      `${__dirname}/csv/${fileName}`,
      'utf-8'
    );

    console.log('File successfully read.');

    const cards = parseCsv(csvString, {
      columns: true,
      skipEmptyLines: true,
      skipRecordsWithEmptyValues: true,
      trim: true,
    });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const invalidUrls = [];

    for (const card of cards) {
      await page.goto(card.mtgmintcardUrl, {
        waitUntil: 'domcontentloaded',
      });

      const pageTitle = await page.title();
      let errors = [];

      if (!pageTitle.includes(card.frontFaceName)) {
        console.log(
          `${chalk.bgRed('ERROR\t')} ${
            card.frontFaceName
          } couldn't be accessed at ${card.mtgmintcardUrl}!`
        );
        invalidUrls.push(`${card.mtgmintcardUrl},Wrong URL`);
        continue;
      }

      if (card.isFoil && !pageTitle.includes('Foil')) {
        errors.push('Card is not foil');
      }

      if (card.variant && !pageTitle.includes(card.variant)) {
        errors.push(`Card is not ${card.variant}`);
      }

      if (card.extraVariant && !pageTitle.includes(card.extraVariant)) {
        errors.push(`Card is not ${card.extraVariant}`);
      }

      if (errors.length > 0) {
        console.log(
          `${chalk.bgRed('ERROR\t')} ${card.mtgmintcardUrl} - ${errors.join(
            ' | '
          )}`
        );
        invalidUrls.push(`${card.mtgmintcardUrl},${errors.join(',')}`);
      } else {
        console.log(`${chalk.bgGreen('SUCCESS\t')} ${card.mtgmintcardUrl}`);
      }
    }

    const fileOutputString = invalidUrls.join('\n');

    await Promise.allSettled([
      fs.writeFile(
        `${__dirname}/result/${fileName}`,
        fileOutputString,
        'utf-8'
      ),
      browser.close(),
    ]);
  } catch {
    console.log('File cannot be accessed! :(');
    process.exit(1);
  }
})();
