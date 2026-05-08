import { chromium } from 'playwright';

const base='http://localhost:5173';

async function main(){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1536,height:960}});
  const page=await context.newPage();

  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.fill('#identifier','superadmin.smoke@sentinel.dev');
  await page.fill('#password','Sentinel!234');
  await page.click('button:has-text("Login")');
  await page.waitForTimeout(1500);

  const agree=page.locator('button:has-text("Agree and Continue")').first();
  if (await agree.count()){
    const terms=page.locator('label:has-text("I have read and agree to the Terms of Agreement.")').first();
    const loc=page.locator('label:has-text("I consent to location processing for live guard and mission tracking.")').first();
    if (await terms.count()) await terms.click();
    if (await loc.count()) await loc.click();
    await agree.click();
    await page.waitForTimeout(1200);
  }

  // open first visible Edit button in users table/cards
  const editBtn = page.locator('button[aria-label^="Edit "]').first();
  await editBtn.click({timeout:5000});
  await page.waitForTimeout(600);

  const modal = page.locator('text=Edit User:').first();
  const email = page.locator('#email').first();
  const username = page.locator('#username').first();

  const title = await modal.textContent();
  const emailDisabled = await email.isDisabled();
  const userDisabled = await username.isDisabled();

  let updated = null;
  if (!emailDisabled && !userDisabled) {
    const stamp = Date.now();
    const newEmail = `sa.edit.${stamp}@sentinel.local`;
    const newUser = `sa_edit_${stamp}`;
    await email.fill(newEmail);
    await username.fill(newUser);
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1400);
    const stillOpen = await page.locator('text=Edit User:').first().isVisible().catch(()=>false);
    const err = await page.locator('.soc-auth-alert-error, .soc-alert-error, .text-danger-text').first().textContent().catch(()=>null);
    updated = { attempted: true, newEmail, newUser, modalStillOpen: stillOpen, error: err };
  }

  console.log(JSON.stringify({title, emailDisabled, userDisabled, updated}, null, 2));

  await page.screenshot({path:'output/playwright/edit-user-superadmin-check.png', fullPage:true});
  await browser.close();
}

main().catch(e=>{ console.error(e); process.exit(1); });
