import {test,expect} from '@playwright/test'
test('onboarding, saved records, care, insights, PDF, privacy and camera error',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/');await expect(page.getByRole('heading',{name:'Your hands. Your story.'})).toBeVisible()
 await page.getByRole('button',{name:'Continue',exact:true}).click()
 await page.getByLabel('Preferred name').fill('Alex')
 await page.getByRole('button',{name:'Continue',exact:true}).click()
 await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeDisabled()
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Enter my self-care space'}).click()
 await expect(page.getByRole('heading',{name:"Hello, Alex. Let's check in."})).toBeVisible()
 await expect(page.getByText('Your first assessment awaits')).toBeVisible()
 await page.getByRole('link',{name:'Symptom Journal',exact:true}).click()
 await page.getByLabel('Anything else on your mind?').fill('Opening a jar was difficult today.')
 await page.getByRole('button',{name:'Save check-in'}).click();await expect(page.getByText('Your check-in is saved.')).toBeVisible()
 await page.reload();await expect(page.getByText('Opening a jar was difficult today.')).toBeVisible()
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Anything else on your mind?').fill('Updated daily note.');await page.getByRole('button',{name:'Update check-in'}).click();await expect(page.getByText('Updated daily note.')).toBeVisible()
 await page.getByRole('link',{name:'Care Routine',exact:true}).click();await page.getByLabel('Medication or care-plan item').fill('My existing plan');await page.getByLabel('Instructions exactly as prescribed').fill('Follow my clinician’s written instructions.');await page.getByRole('button',{name:'Add routine',exact:true}).click();await expect(page.getByRole('heading',{name:'My existing plan'})).toBeVisible();await page.getByRole('button',{name:'Completed',exact:true}).click();await expect(page.getByRole('button',{name:'Completed',exact:true})).toHaveClass(/selected/)
 await page.getByRole('link',{name:'Record Insights',exact:true}).click();await page.getByRole('button',{name:'How has my hand mobility changed?'}).click();await expect(page.getByText(/Insufficient Data. There are 0 valid sessions/)).toBeVisible();await page.getByRole('textbox',{name:'Message to companion'}).fill('Should I double my dose?');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText(/I cannot diagnose arthritis/)).toBeVisible()
 await page.getByRole('link',{name:'Appointment Prep',exact:true}).click();await page.getByRole('button',{name:'Generate draft for review'}).click();await expect(page.getByRole('button',{name:'Download PDF'})).toBeDisabled();await page.getByRole('checkbox',{name:/I have reviewed/}).check();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF'}).click();expect((await download).suggestedFilename()).toBe('ArthriTrack-summary.pdf')
 await page.getByRole('link',{name:'Hand Assessment',exact:true}).click();await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}});await page.getByRole('button',{name:'Set up camera'}).click();await expect(page.getByRole('alert')).toContainText('permission was denied')
 await page.getByRole('button',{name:'Explore demo',exact:true}).click();await expect(page.getByText(/DEMO DATA · Synthetic examples, isolated/)).toBeVisible();await page.getByRole('link',{name:'Overview',exact:true}).click();await expect(page.locator('.recharts-surface').first()).toBeVisible();await page.screenshot({path:'test-results/overview-'+test.info().project.name+'.png',fullPage:true});await page.getByRole('link',{name:'My Progress',exact:true}).click();await expect(page.getByText('Repeated Change Observed')).toBeVisible();await page.getByRole('button',{name:'Exit demo data'}).click();await expect(page.getByText('Insufficient Data')).toBeVisible()
 await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('checkbox',{name:'High-readability mode'}).check();await page.getByRole('button',{name:'Save preferences'}).click();await expect(page.getByText('Preferences saved.')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
 await page.screenshot({path:`test-results/arthritrack-${test.info().project.name}.png`,fullPage:true})
 expect(errors).toEqual([])
})

test('real MediaPipe model loads and rejects an empty frame',async({page})=>{
 await page.goto('/')
 const count=await page.evaluate(async()=>{
   const path='/src/vision/tracker.ts';const {createTracker}=await import(path)
   const tracker=await createTracker();const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480
   const ctx=canvas.getContext('2d')!;ctx.fillStyle='black';ctx.fillRect(0,0,640,480)
   try{return tracker.detectForVideo(canvas,performance.now()).landmarks.length}finally{tracker.close()}
 })
 expect(count).toBe(0)
})

