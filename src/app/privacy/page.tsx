import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "Privacy Policy",
  description: "How Radius Disc Golf collects, uses, and protects your information across iOS, Android, and the web.",
};

const HTML = `
<h2>Introduction</h2>
<p>Radius Disc Golf ("Radius," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Radius Disc Golf mobile application on Apple iOS (distributed through the Apple App Store) and on Android (distributed through the Google Play Store), as well as our website at radiusdiscgolf.com (together, the "Services," and the mobile applications, the "App"). Please read this policy carefully. By using the Services, you agree to the collection and use of information in accordance with this policy.</p>

<h2>Platforms This Policy Covers</h2>
<p>This policy applies to all versions of Radius regardless of how you access it:</p>
<ul>
  <li><strong>iOS App</strong> — the Radius app for iPhone and iPad, downloaded from the Apple App Store.</li>
  <li><strong>Android App</strong> — the Radius app for Android devices, downloaded from the Google Play Store.</li>
  <li><strong>Web</strong> — the Radius website and account dashboard at radiusdiscgolf.com.</li>
</ul>
<p>The information we collect and the way it is stored is largely the same across platforms, but some details differ by operating system and app store. Where a practice is specific to iOS or Android, we say so.</p>

<h2>Information We Collect</h2>
<p><strong>Account Information:</strong> When you create an account, we collect your name, email address, username, and profile photo. During signup we also ask for your gender, which we use to place you in the appropriate division for rankings, leaderboards, and other competitive features. Depending on the sign-in method you choose, we may receive a basic account identifier from Apple or Google to authenticate you.</p>
<p><strong>Player Profile Details:</strong> Information you add to your player profile, such as your throwing hand, throwing style, arm speed, bio, and home course. These details personalize features like Caddy recommendations and your public profile.</p>
<p><strong>Gameplay Data:</strong> We collect data related to your disc golf rounds, including scores, disc selections, course information, hole-by-hole performance, and Game IQ metrics (distance control, accuracy, and putting scores).</p>
<p><strong>Bag and Disc Data:</strong> Information about the discs in your bag, including disc names, manufacturers, flight numbers, nicknames, condition, and usage statistics.</p>
<p><strong>Photos and Camera:</strong> With your permission, we access your camera and photo library so you can scan discs with the Disc Scanner, set a profile photo, and add course or gallery photos. Images you choose to upload are stored as described in "How Your Data Is Stored and Synced." We only access photos you select or capture for these features.</p>
<p><strong>Location Data:</strong> With your permission, we collect location data to provide course maps, satellite imagery, distance measurements, and weather conditions during gameplay, and to help you find local casual rounds and meetups. You control location access through your device settings (see "Device Permissions").</p>
<p><strong>Device and Technical Information:</strong> We may collect your device type and model, operating system and version, app version, language and region settings, app-instance identifiers, and general diagnostic, performance, and crash data. On Android this may include Android-specific device identifiers; on iOS it may include the iOS identifier-for-vendor. This information helps us operate the App, fix bugs, and improve performance.</p>
<p><strong>User-Generated Content:</strong> Posts, comments, forum threads, course submissions, reviews, and other content you create within the community features of the Services.</p>

<h2>Device Permissions</h2>
<p>Radius only requests the device permissions needed for features you use. You can grant or revoke each permission at any time:</p>
<ul>
  <li><strong>Location</strong> — for course maps, distances, weather, and local rounds.</li>
  <li><strong>Camera</strong> — for the Disc Scanner and capturing photos.</li>
  <li><strong>Photos / Media / Storage</strong> — to select and upload profile, course, and gallery images.</li>
  <li><strong>Notifications</strong> — for community activity and app updates, if you opt in.</li>
</ul>
<p><strong>On Android:</strong> manage permissions in <em>Settings → Apps → Radius → Permissions</em>. <strong>On iOS:</strong> manage permissions in <em>Settings → Radius</em>. Disabling a permission may limit related features (for example, disabling location limits course maps, weather, and local meetups).</p>

<h2>How We Use Your Information</h2>
<ul>
  <li>Provide, operate, and maintain the App and its features</li>
  <li>Power Caddy recommendations based on your bag, the hole, and current conditions</li>
  <li>Calculate and update your Game IQ performance metrics</li>
  <li>Display satellite course maps and real-time weather data</li>
  <li>Enable community features such as the Discover feed, forums, local meetups, course building, and player connections</li>
  <li>Place you in the appropriate division for rankings, leaderboards, and other competitive features</li>
  <li>Sync your data across your devices and platforms (iOS, Android, and web)</li>
  <li>Improve and personalize your experience</li>
  <li>Diagnose crashes, monitor performance, and understand aggregate feature usage</li>
  <li>Communicate with you about updates, features, and support</li>
  <li>Detect, prevent, and address technical issues, fraud, or abuse</li>
</ul>
<p>We may use your email address to contact you about material updates to the App, new features, service changes, or account matters. You may unsubscribe from non-essential communications at any time using the link in the footer of any email we send, or by emailing us at <a href="mailto:info@radiusdiscgolf.com">info@radiusdiscgolf.com</a>. Account and security-related emails (such as password changes or legal notices) cannot be unsubscribed from while your account is active.</p>
<p>With your consent (by creating an account), we may send occasional product updates and release announcements via Mailchimp. You may unsubscribe from these at any time without affecting your account.</p>

<h2>How Your Data Is Stored and Synced</h2>
<p>Your account and gameplay data are stored on secure cloud infrastructure and, in part, on your device:</p>
<ul>
  <li><strong>Android:</strong> Your data is stored locally on your device and synced to Google Firebase (Cloud Firestore and Cloud Storage) so it is available across your devices and on the web.</li>
  <li><strong>iOS:</strong> Your data is stored in Apple iCloud / CloudKit and synced to Google Firebase (Cloud Firestore and Cloud Storage) to enable cross-platform access.</li>
  <li><strong>Web:</strong> When you sign in at radiusdiscgolf.com, your data is read from and written to the same Google Firebase backend.</li>
</ul>
<p>Because Radius is cross-platform, data you create on one platform (for example, your bag or a round logged on Android) is synced through Firebase and can appear on your other signed-in devices and on the web dashboard.</p>

<h2>AI and Machine Learning</h2>
<p>Radius uses machine learning to power features like Caddy disc recommendations, Game IQ scoring, and Disc Scanner identification. These features process your gameplay data, bag configuration, and environmental conditions (wind, temperature, hole layout) to generate personalized recommendations. This processing occurs on our servers and through the third-party providers listed below; the data used to generate recommendations is not sold or shared for unrelated purposes, and is not used to train third-party models except as permitted under our agreements with those providers.</p>

<h2>Analytics and Crash Reporting</h2>
<p>To keep Radius reliable and to understand which features are used, we collect aggregate analytics and crash diagnostics:</p>
<ul>
  <li><strong>Google Analytics for Firebase</strong> — measures aggregate, app-level usage on both the iOS and Android apps.</li>
  <li><strong>Firebase Crashlytics</strong> — captures crash reports and stability diagnostics so we can fix problems.</li>
  <li><strong>Google Analytics</strong> — measures aggregate usage of the radiusdiscgolf.com website.</li>
  <li><strong>TelemetryDeck</strong> — privacy-focused, anonymized usage analytics on iOS, with no personal identifiers.</li>
</ul>
<p>This data is used in aggregate to improve the Services and is not used to advertise to you. You can reset or limit advertising and analytics identifiers through your device settings (on Android, via <em>Settings → Privacy → Ads</em>; on iOS, via <em>Settings → Privacy & Security → Tracking</em>).</p>

<h2>Subscriptions and Payments</h2>
<p>Radius Pro subscriptions are processed by the app store you purchased through. We never receive or store your payment card details:</p>
<ul>
  <li><strong>iOS:</strong> Purchases are handled by Apple through the App Store (StoreKit), subject to <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noopener">Apple's Privacy Policy</a>.</li>
  <li><strong>Android:</strong> Purchases are handled by Google through Google Play Billing, subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</li>
</ul>
<p>We receive confirmation of your subscription status from the relevant store in order to unlock Radius Pro features for your account.</p>

<h2>Sharing of Information</h2>
<p>We do not sell your personal information to any third party, and we do not display third-party advertising in the App or use your data to serve you targeted ads. We may share information in the following limited circumstances:</p>
<ul>
  <li><strong>Community Features:</strong> Content you post publicly (forum threads, Discover posts, comments, course submissions, reviews) is visible to other users of the Services</li>
  <li><strong>Service Providers:</strong> With the trusted providers listed below, only as necessary to operate the Services</li>
  <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
  <li><strong>Safety:</strong> When we believe it is necessary to protect the safety, rights, or property of Radius, our users, or the public</li>
</ul>

<h2>Third-Party Services We Use</h2>
<p>We share limited data with the following trusted service providers, each subject to their own privacy practices. We only share what's necessary for them to perform their service:</p>
<ul>
  <li><strong>Google Firebase (Google LLC)</strong> — provides our cloud database (Cloud Firestore), file storage (Cloud Storage), authentication, analytics, and crash reporting across the Android and iOS apps and the website. Governed by <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">Firebase's Privacy and Security</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</li>
  <li><strong>Google Play Billing</strong> — processes Radius Pro subscriptions on Android. We never see or store your payment details; they are handled directly by Google. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</li>
  <li><strong>Apple iCloud / CloudKit</strong> — stores your profile, courses, rounds, and other app data on iOS. Governed by <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noopener">Apple's Privacy Policy</a>.</li>
  <li><strong>Apple StoreKit / App Store</strong> — processes your Radius Pro subscription on iOS. We never see or store your payment details; they are handled directly by Apple.</li>
  <li><strong>OpenAI</strong> — powers the Caddy recommendations. When you request a recommendation, we send the relevant context (your bag, the hole, conditions) to OpenAI's API. We do not share personally identifying information with OpenAI, and requests are not used to train their models per our API agreement. See <a href="https://openai.com/privacy/" target="_blank" rel="noopener">OpenAI's Privacy Policy</a>.</li>
  <li><strong>Mapbox</strong> — provides map and satellite imagery on our website. Your approximate location or map view may be sent to render maps. See <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener">Mapbox's Privacy Policy</a>.</li>
  <li><strong>TelemetryDeck</strong> — anonymized, privacy-focused analytics on iOS. No personal identifiers are sent; only aggregate usage signals. See <a href="https://telemetrydeck.com/privacy/" target="_blank" rel="noopener">TelemetryDeck's Privacy Policy</a>.</li>
  <li><strong>Giphy</strong> — powers animated image search within the app. Your search queries are sent to Giphy's API. See <a href="https://support.giphy.com/hc/en-us/articles/360032872931" target="_blank" rel="noopener">Giphy's Privacy Policy</a>.</li>
  <li><strong>Mailchimp</strong> — sends product update and announcement emails. Your email address and name are stored with Mailchimp for this purpose. See <a href="https://mailchimp.com/legal/privacy/" target="_blank" rel="noopener">Mailchimp's Privacy Policy</a>.</li>
</ul>
<p>Map, satellite imagery, and weather information shown in the App may be provided by additional third-party mapping and weather services, each subject to their own privacy policies. We do not sell your personal information to any third party.</p>

<h2>Data Storage and Security</h2>
<p>Your data is stored on secure cloud infrastructure operated by Google (Firebase / Google Cloud) and Apple (iCloud / CloudKit), as well as locally on your device, with industry-standard encryption in transit and access controls. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>

<h2>Children's Privacy</h2>
<p>The App is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected information from a child under 13, we will promptly delete that information. Our distribution through the Apple App Store and Google Play is also subject to those platforms' policies regarding children and families.</p>

<h2>Your California Privacy Rights</h2>
<p>If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA):</p>
<ul>
  <li>Right to know what personal information we have collected about you.</li>
  <li>Right to delete your personal information, subject to certain exceptions.</li>
  <li>Right to correct inaccurate personal information.</li>
  <li>Right to opt out of the sale or sharing of personal information. We do not sell or share personal information as those terms are defined under the CCPA.</li>
  <li>Right to limit the use of sensitive personal information.</li>
  <li>Right to non-discrimination for exercising any of these rights.</li>
</ul>
<p>To exercise any of these rights, email us at <a href="mailto:info@radiusdiscgolf.com">info@radiusdiscgolf.com</a> with the subject line "California Privacy Request." We will verify your identity by matching the email address on your account and will respond within 45 days.</p>

<h2>Your Rights Under GDPR (EU / UK Users)</h2>
<p>If you are located in the European Economic Area, United Kingdom, or Switzerland, you have the following rights:</p>
<ul>
  <li>Right of access to the personal data we hold about you.</li>
  <li>Right to rectification of inaccurate data.</li>
  <li>Right to erasure ("right to be forgotten").</li>
  <li>Right to restrict processing of your data.</li>
  <li>Right to data portability — receive your data in a structured, machine-readable format.</li>
  <li>Right to object to processing based on legitimate interests.</li>
  <li>Right to withdraw consent where processing is based on consent.</li>
</ul>
<p><strong>Our legal basis for processing:</strong></p>
<ul>
  <li><strong>Contract performance</strong> — to provide the App and the features you request.</li>
  <li><strong>Legitimate interests</strong> — to improve the App, prevent fraud, and communicate about the service.</li>
  <li><strong>Consent</strong> — where required (e.g., optional analytics or marketing).</li>
  <li><strong>Legal obligations</strong> — where we are required by law to process data.</li>
</ul>
<p>To exercise any of these rights, email <a href="mailto:info@radiusdiscgolf.com">info@radiusdiscgolf.com</a>. You also have the right to lodge a complaint with your local data protection authority.</p>

<h2>Your Choices and Data Deletion</h2>
<p>We retain your personal information for as long as your account is active or as needed to provide you with the Services. If you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal or legitimate business purposes.</p>
<p><strong>Account Deletion:</strong> You may delete your account and associated data directly within the App (in your Profile settings) on both iOS and Android, or by contacting us at <a href="mailto:info@radiusdiscgolf.com">info@radiusdiscgolf.com</a>. Deleting your account removes your data from our Firebase backend and, on iOS, from your associated CloudKit records.</p>
<p><strong>Location and Permissions:</strong> You can enable or disable location, camera, photos, and notification access at any time through your device settings (Android: <em>Settings → Apps → Radius → Permissions</em>; iOS: <em>Settings → Radius</em>). Disabling a permission may limit certain features such as course maps, weather data, the Disc Scanner, and local meetups.</p>
<p><strong>Data Access:</strong> You have the right to request a copy of the personal data we hold about you.</p>
<p><strong>Corrections:</strong> You may update or correct your account information at any time within the App's Profile settings.</p>

<h2>Third-Party Links and Services</h2>
<p>The Services may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party services you access through the Services.</p>

<h2>Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. When we make changes, we will update the "Last updated" date at the top of this page. Your continued use of the Services after changes are posted constitutes your acceptance of the revised policy.</p>

<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy or want to exercise any of the rights described above, you can reach us at:</p>
<p><strong>Radius Disc Golf</strong><br>
Email: <a href="mailto:info@radiusdiscgolf.com">info@radiusdiscgolf.com</a></p>
`;

export default function PrivacyPage() {
  return <LegalLayout title="Privacy Policy" updated="Last updated: July 20, 2026" html={HTML} />;
}
