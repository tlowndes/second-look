import type { Critique } from "./types";

/* A checkout screen with deliberate problems, exported Figma-style with layer ids. */

export const SAMPLE_NAME = "checkout-screen.svg";

const FONT = 'font-family="Inter, Helvetica, Arial, sans-serif"';
export const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" fill="none">
<defs><linearGradient id="slBanner" x1="16" y1="588" x2="374" y2="664" gradientUnits="userSpaceOnUse"><stop stop-color="#F4B860"/><stop offset="1" stop-color="#E86F51"/></linearGradient>
<linearGradient id="slProduct" x1="32" y1="128" x2="120" y2="216" gradientUnits="userSpaceOnUse"><stop stop-color="#D9CBB4"/><stop offset="1" stop-color="#B9A98F"/></linearGradient></defs>
<g id="Checkout_screen">
<rect id="Background" width="390" height="844" fill="#F6F7F9"/>
<text id="Time" x="28" y="34" fill="#111418" ${FONT} font-size="15" font-weight="600">9:41</text>
<g id="Back_button"><rect x="16" y="60" width="28" height="28" rx="14" fill="#FFFFFF"/><path d="M33 67 L26 74 L33 81" stroke="#111418" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
<text id="Title" x="195" y="80" text-anchor="middle" fill="#111418" ${FONT} font-size="17" font-weight="600">Checkout</text>
<text id="Step" x="374" y="79" text-anchor="end" fill="#9AA0A8" ${FONT} font-size="13">Step 2 of 3</text>
<g id="Order_card"><rect x="16" y="112" width="358" height="148" rx="16" fill="#FFFFFF"/>
<rect id="Product_image" x="32" y="128" width="88" height="88" rx="10" fill="url(#slProduct)"/>
<text id="Product_name" x="136" y="150" fill="#111418" ${FONT} font-size="16" font-weight="600">Linen overshirt</text>
<text id="Product_meta" x="136" y="171" fill="#A3A8B0" ${FONT} font-size="13">Sand · Size M</text>
<text id="Price" x="136" y="206" fill="#111418" ${FONT} font-size="16" font-weight="700">£48.00</text>
<g id="Minus_button"><rect x="262" y="186" width="30" height="30" rx="8" fill="#F1F2F4"/><path d="M271 201 H283" stroke="#111418" stroke-width="2" stroke-linecap="round"/></g>
<text id="Quantity" x="306" y="206" text-anchor="middle" fill="#111418" ${FONT} font-size="15" font-weight="600">1</text>
<g id="Plus_button"><rect x="320" y="186" width="30" height="30" rx="8" fill="#F1F2F4"/><path d="M329 201 H341 M335 195 V207" stroke="#111418" stroke-width="2" stroke-linecap="round"/></g>
<text id="Delivery_note" x="32" y="244" fill="#A3A8B0" ${FONT} font-size="12">Ships in 3–5 working days</text></g>
<g id="Promo_code_input"><rect x="16.5" y="284.5" width="249" height="47" rx="11.5" fill="#FFFFFF" stroke="#E2E5E9"/><text id="Placeholder" x="32" y="313" fill="#B4B9C0" ${FONT} font-size="15">Promo code</text></g>
<g id="Apply_button_disabled"><rect x="276" y="284" width="98" height="48" rx="12" fill="#E9EBEE"/><text x="325" y="313" text-anchor="middle" fill="#B9BEC5" ${FONT} font-size="15" font-weight="600">Apply</text></g>
<text id="Section_title_Delivery" x="16" y="372" fill="#111418" ${FONT} font-size="13" font-weight="700" letter-spacing="0.6">DELIVERY</text>
<g id="Delivery_option"><rect x="16" y="384" width="358" height="64" rx="12" fill="#FFFFFF"/>
<g id="Radio_selected"><circle cx="40" cy="416" r="9" stroke="#2F6FED" stroke-width="2"/><circle cx="40" cy="416" r="4.5" fill="#2F6FED"/></g>
<text x="62" y="412" fill="#111418" ${FONT} font-size="15" font-weight="500">Standard delivery</text>
<text x="62" y="432" fill="#6B7280" ${FONT} font-size="13">Free · Thu 26 Nov</text>
<text x="358" y="421" text-anchor="end" fill="#111418" ${FONT} font-size="15" font-weight="600">£0.00</text></g>
<text id="Section_title_Payment" x="16" y="488" fill="#111418" ${FONT} font-size="13" font-weight="700" letter-spacing="0.6">PAYMENT</text>
<g id="Payment_card"><rect x="16" y="500" width="358" height="64" rx="12" fill="#FFFFFF"/>
<rect id="Card_logo" x="32" y="520" width="38" height="24" rx="4" fill="#1A1F71"/>
<text x="84" y="528" fill="#111418" ${FONT} font-size="15" font-weight="500">Visa ending 4021</text>
<text id="Error_message" x="84" y="549" fill="#E5484D" ${FONT} font-size="13">Card expired</text>
<text id="Change_link" x="358" y="538" text-anchor="end" fill="#2F6FED" ${FONT} font-size="14" font-weight="600">Change</text></g>
<g id="Promo_banner"><rect x="16" y="588" width="358" height="76" rx="14" fill="url(#slBanner)"/>
<text x="32" y="620" fill="#FFFFFF" ${FONT} font-size="16" font-weight="700">Free returns for 30 days</text>
<text x="32" y="644" fill="#FFFFFF" ${FONT} font-size="13">Members get early access to the sale</text></g>
<rect id="Bottom_bar" x="0" y="696" width="390" height="148" fill="#FFFFFF"/>
<text x="16" y="730" fill="#6B7280" ${FONT} font-size="15">Total</text>
<text x="374" y="731" text-anchor="end" fill="#111418" ${FONT} font-size="20" font-weight="700">£48.00</text>
<g id="Pay_button"><rect x="16" y="748" width="358" height="52" rx="14" fill="#2F6FED"/><text x="195" y="780" text-anchor="middle" fill="#FFFFFF" ${FONT} font-size="17" font-weight="600">Pay £48.00</text></g>
<text id="Continue_shopping_link" x="195" y="826" text-anchor="middle" fill="#2F6FED" ${FONT} font-size="13">Continue shopping</text>
</g></svg>`;

/** A pre-written critique so the Critique tab has something to show before anyone runs it. */
export const SAMPLE_CRITIQUE: Critique = {
  example: true, tone: "mentor",
  overall: "The screen is calm and the Pay button is easy to find, with a sensible top-to-bottom order. The biggest problem is the expired card: the only sign of it is small red text, so people will press Pay and hit an error.",
  scores: {
    hierarchy: { score: 4, why: "Pay is the clear focal point, but the promo banner competes for attention mid-screen." },
    contrast: { score: 2, why: "Secondary text, the placeholder and the banner copy all sit well under 4.5:1." },
    consistency: { score: 3, why: "Corner radii drift between 8, 10, 12, 14 and 16 pt across similar elements." }
  },
  issues: [
    { severity: "high", category: "Hierarchy", check: "Reading order", element: "Payment card, “Card expired”", problem: "The expired card is flagged only by 13 pt red text under the card name. Most people will reach Pay before they notice it.", fix: "Give the whole payment card an error state: a 1.5 pt red border, an alert icon and the message in 15 pt. Swap “Change” for a full-width “Update card” button.", principle: "Error prevention", pin: { x: 0.33, y: 0.645 } },
    { severity: "high", category: "Contrast", check: "Text against background", element: "Promo banner copy", problem: "White text on the orange gradient measures under 2:1, so the offer is hard to read for many people.", fix: "Use #141820 text on the banner, or darken the gradient until white text reaches 4.5:1 at its lightest point.", principle: "Contrast (minimum)", pin: { x: 0.22, y: 0.733 } },
    { severity: "medium", category: "Hierarchy", check: "One clear focal point", element: "Promo banner", problem: "The saturated banner is the loudest thing on screen and sits between Payment and Pay, which pulls the eye away from finishing the task.", fix: "Move it below the total as a one-line tinted note, or drop it from checkout altogether.", principle: "Von Restorff effect", pin: { x: 0.82, y: 0.745 } },
    { severity: "medium", category: "Contrast", check: "Text against background", element: "“Step 2 of 3”, “Sand · Size M” and the delivery note", problem: "Light grey secondary text sits around 2.4:1, below the 4.5:1 body text minimum.", fix: "Use #6B7280 for all secondary text. It measures 4.8:1 on white and still reads as secondary.", principle: "Contrast (minimum)", pin: { x: 0.9, y: 0.092 } },
    { severity: "medium", category: "Hierarchy", check: "Grouping", element: "Promo code field and Apply", problem: "The field floats between the order card and Delivery with no label, so it reads as part of neither.", fix: "Add a “Promo code” label, 24 pt of space above the group and 8 pt between label and field.", principle: "Law of proximity", pin: { x: 0.36, y: 0.364 } },
    { severity: "low", category: "Consistency", check: "Components", element: "“Change” and “Continue shopping” links", problem: "The two text links use different sizes and weights (14 pt semibold and 13 pt regular).", fix: "Pick one link style, 15 pt semibold in the accent blue, and give both links a 44 pt tap height.", principle: "Consistency and standards", pin: { x: 0.5, y: 0.976 } },
    { severity: "low", category: "Consistency", check: "Spacing rhythm", element: "Cards, field and buttons", problem: "Corner radii are 8, 10, 12, 14 and 16 pt across elements that sit side by side.", fix: "Use two radii: 12 pt for cards and fields, 8 pt for small controls.", principle: "Law of similarity", pin: { x: 0.955, y: 0.14 } }
  ]
};
