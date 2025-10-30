// Set year
document.getElementById('year').textContent = new Date().getFullYear();

// Track Uploadcare state and enable "Continue" when we have a file + expression
let uploadedUrl = null;
let chosenExpr = 'HAPPY_SOFT';

const uploader = uploadcare.Widget('[role=uploadcare-uploader]');
uploader.onUploadComplete(info => {
  uploadedUrl = info.cdnUrl;
  mark('stUpload', true);
  maybeEnableContinue();
});

document.getElementById('expressionChoices').addEventListener('change', (e)=>{
  if (e.target.name === 'expr') {
    chosenExpr = e.target.value;
    mark('stReady', true);
    maybeEnableContinue();
  }
});

function mark(id, ok){
  const el = document.getElementById(id);
  el.classList.remove('dot--gray','dot--green');
  el.classList.add(ok ? 'dot--green' : 'dot--gray');
}

function maybeEnableContinue(){
  const btn = document.getElementById('btnProceed');
  btn.disabled = !(uploadedUrl && chosenExpr);
}

document.getElementById('btnProceed').addEventListener('click', () => {
  // MVP: send the user to Stripe with query params for later reconciliation
  // Replace these with your actual Payment Links in HTML data attributes if you want pack selection here
  // For now, default to Standard:
  const defaultStripe = document.querySelector('[data-stripe*="standard"]')?.getAttribute('data-stripe')
                       || 'https://buy.stripe.com/test_standard_link';

  // Pass along context you’ll read after payment (via success redirect or webhook reconciliation)
  const params = new URLSearchParams({
    photo: uploadedUrl,
    expr: chosenExpr
  });
  window.location.href = `${defaultStripe}?${params.toString()}`;
});

// Top CTAs smooth-scroll
['ctaStartTop','ctaStartHero'].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e=>{
    e.preventDefault();
    document.querySelector('#start').scrollIntoView({behavior:'smooth'});
  });
});
