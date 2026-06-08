import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of the Radius Disc Golf app.",
};

const HTML = `
<h2>Agreement to Terms</h2>
<p>By downloading, installing, or using the Radius Disc Golf mobile application (the "App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.</p>

<h2>Eligibility</h2>
<p>You must be at least 13 years of age to use the App. By using the App, you represent and warrant that you meet this age requirement.</p>

<h2>Account Registration</h2>
<p>To access certain features, you must create an account. You agree to provide accurate, current, and complete information and to keep your account credentials secure. You are responsible for all activity that occurs under your account.</p>

<h2>Use of the App</h2>
<p>Radius grants you a limited, non-exclusive, non-transferable, revocable license to use the App for your personal, non-commercial use. You agree not to:</p>
<ul>
  <li>Use the App for any unlawful purpose or in violation of these Terms</li>
  <li>Reverse engineer, decompile, or disassemble any part of the App</li>
  <li>Attempt to gain unauthorized access to the App's systems or other users' accounts</li>
  <li>Use automated systems (bots, scrapers, etc.) to access or interact with the App</li>
  <li>Interfere with or disrupt the integrity or performance of the App</li>
  <li>Upload or share content that is illegal, harmful, threatening, abusive, defamatory, or otherwise objectionable</li>
</ul>

<h2>AI-Powered Features</h2>
<p>The App includes AI-powered features such as CaddyAI disc recommendations, Game IQ scoring, the Disc Scanner, and personalized Learn content. These features provide suggestions and analysis based on available data and are intended for informational and entertainment purposes only. Radius does not guarantee the accuracy or completeness of any AI-generated recommendation. You use these features at your own discretion.</p>

<h2>User-Generated Content</h2>
<p>You retain ownership of content you create and share through the App (posts, comments, forum threads, etc.). By posting content, you grant Radius a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute that content within the App and for promotional purposes. You are solely responsible for the content you post and must not post content that infringes on the intellectual property rights of others.</p>

<h2>Community Guidelines</h2>
<p>When using community features (Discover feed, forums, local meetups), you agree to:</p>
<ul>
  <li>Treat other users with respect</li>
  <li>Not post spam, misleading content, or unsolicited advertising</li>
  <li>Not harass, bully, or threaten other users</li>
  <li>Not impersonate other individuals or entities</li>
</ul>
<p>Radius reserves the right to remove content and suspend or terminate accounts that violate these guidelines at our sole discretion.</p>

<h2>Intellectual Property</h2>
<p>The App and its original content (excluding user-generated content), features, and functionality are owned by Radius Disc Golf and are protected by copyright, trademark, and other intellectual property laws. The Radius name, logo, and all related marks are trademarks of Radius Disc Golf.</p>

<h2>Third-Party Services</h2>
<p>The App may integrate with or link to third-party services (e.g., Apple Maps, weather data providers). Your use of these services is subject to their respective terms and privacy policies. Radius is not responsible for the content or practices of any third-party services.</p>

<h2>Disclaimer of Warranties</h2>
<p>The App is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied. Radius does not warrant that the App will be uninterrupted, error-free, or free of harmful components. Disc golf involves physical activity and inherent risks — always exercise caution and good judgment on the course regardless of any recommendations provided by the App.</p>

<h2>Limitation of Liability</h2>
<p>To the fullest extent permitted by law, Radius Disc Golf shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, profits, or goodwill, arising out of or related to your use of the App.</p>

<h2>Termination</h2>
<p>We may suspend or terminate your access to the App at any time, with or without cause and with or without notice. Upon termination, your right to use the App will immediately cease. You may delete your account at any time by contacting us.</p>

<h2>Changes to These Terms</h2>
<p>We may update these Terms from time to time. When we make changes, we will update the "Last updated" date at the top of this page. Your continued use of the App after changes are posted constitutes your acceptance of the revised Terms.</p>

<h2>Governing Law</h2>
<p>These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles.</p>

<h2>Contact Us</h2>
<p>If you have any questions about these Terms, please contact us at:</p>
<p><strong>Radius Disc Golf</strong><br>
Email: <a href="mailto:mikey@radiusdiscgolf.com">mikey@radiusdiscgolf.com</a></p>
`;

export default function TermsPage() {
  return <LegalLayout title="Terms of Service" updated="Last updated: March 16, 2026" html={HTML} />;
}
