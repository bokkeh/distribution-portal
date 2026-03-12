import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - AHAWC Distribution Portal',
  description: 'Privacy Policy for the AHAWC Liquor Distribution Portal',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-slate-900 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-white">AHAWC</span>
          <Link href="/login" className="text-sm text-slate-300 transition-colors hover:text-white">
            Sign In -&gt;
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective date: March 9, 2026 &nbsp;|&nbsp; Last updated: March 12, 2026
          </p>
        </div>

        <p className="leading-relaxed text-slate-700">
          AHAWC (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the AHAWC Distribution
          Portal (the &quot;Portal&quot;), a private business-to-business platform used to manage
          orders, invoices, deliveries, and customer accounts for licensed liquor retailers and
          hospitality businesses. This Privacy Policy explains how we collect, use, disclose, and
          safeguard information when you access the Portal.
        </p>

        <Section title="1. Information We Collect">
          <p>We collect the following categories of information when you register or use the Portal:</p>
          <ul>
            <li><strong>Account information:</strong> name, business email address, phone number, and role (for example, customer, staff, or driver).</li>
            <li><strong>Business information:</strong> company name, billing address, DC ABRA license number, payment terms, credit limit, and outstanding balance.</li>
            <li><strong>Order and transaction data:</strong> products ordered, quantities, order status, invoice amounts, and payment records.</li>
            <li><strong>Delivery information:</strong> delivery addresses, geolocation coordinates used for route planning, and stop completion timestamps.</li>
            <li><strong>Communication data:</strong> SMS messages sent through the Portal and email notifications delivered via our service providers.</li>
            <li><strong>Usage data:</strong> pages visited, actions taken within the Portal, browser type, IP address, user agent, and timestamps.</li>
            <li><strong>Lead form submissions:</strong> business name, email address, mobile number, SMS opt-in preference, and submission metadata collected through our wholesale account request form.</li>
            <li><strong>Payment data:</strong> payment intent identifiers from Stripe. We do not store full card numbers or bank account credentials on our servers.</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information collected to:</p>
          <ul>
            <li>Authenticate users and maintain account security.</li>
            <li>Process and fulfill product orders and generate invoices.</li>
            <li>Plan and track delivery routes and update stop statuses.</li>
            <li>Respond to wholesale account requests and onboard approved customers.</li>
            <li>Send transactional notifications and requested SMS updates about account setup, orders, invoices, and deliveries.</li>
            <li>Sync account and contact data with HubSpot for CRM purposes.</li>
            <li>Process payments securely through Stripe.</li>
            <li>Monitor Portal usage to improve functionality and security.</li>
            <li>Comply with applicable federal, state, and local laws, including alcohol beverage control regulations.</li>
          </ul>
        </Section>

        <Section title="3. How We Share Your Information">
          <p>We do not sell your personal information. We may share data with the following categories of third parties only as necessary to operate the Portal:</p>
          <ul>
            <li><strong>Stripe</strong> - payment processing (subject to Stripe&apos;s Privacy Policy).</li>
            <li><strong>Resend</strong> - transactional email delivery.</li>
            <li><strong>Telnyx</strong> - SMS notification delivery.</li>
            <li><strong>HubSpot</strong> - CRM and contact management.</li>
            <li><strong>Google Cloud Storage</strong> - secure document and image storage.</li>
            <li><strong>Neon (PostgreSQL)</strong> - cloud database hosting.</li>
            <li><strong>Vercel</strong> - application hosting and serverless compute.</li>
            <li><strong>Google Maps</strong> - geocoding and delivery route visualization.</li>
          </ul>
          <p>
            Mobile phone numbers and SMS opt-in data are not shared, sold, rented, or disclosed to
            third parties or affiliates for their marketing or promotional purposes.
          </p>
          <p>
            We may also disclose information when required by law, court order, or governmental
            authority, or to protect the rights, safety, or property of AHAWC or others.
          </p>
        </Section>

        <Section title="4. Data Retention">
          <p>
            We retain account, lead, and transaction records for as long as needed to operate the
            Portal and as required by applicable law, including record-keeping obligations under
            alcohol beverage control regulations. You may request deletion of your personal account
            data by contacting us at the address below; certain business records may still be
            retained to satisfy legal obligations.
          </p>
        </Section>

        <Section title="5. Security">
          <p>
            We implement industry-standard safeguards including encrypted connections (TLS/HTTPS),
            hashed password storage (bcrypt), JWT-based session authentication with expiry, and
            role-based access controls. No method of transmission over the internet is 100% secure,
            and we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="6. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul>
            <li>Access the personal information we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your personal data, subject to legal retention requirements.</li>
            <li>Withdraw consent for optional communications such as SMS notifications.</li>
          </ul>
          <p>To exercise any of these rights, please contact us using the information in Section 10.</p>
        </Section>

        <Section title="7. Cookies and Tracking">
          <p>
            The Portal uses session cookies and JWT tokens for authentication. We do not use
            third-party advertising cookies or tracking pixels. Usage data is collected solely to
            operate and improve the Portal.
          </p>
        </Section>

        <Section title="8. Children&apos;s Privacy">
          <p>
            The Portal is a business-to-business platform intended solely for licensed commercial
            entities and their authorized employees. It is not directed to individuals under the age
            of 21. We do not knowingly collect personal information from minors.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy periodically. When we do, we will revise the
            &quot;Last updated&quot; date at the top of this page. Continued use of the Portal after
            changes are posted constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="10. Contact Us">
          <p>If you have questions or requests regarding this Privacy Policy, please contact:</p>
          <address className="mt-2 space-y-0.5 not-italic text-slate-700">
            <p className="font-semibold">AHAWC</p>
            <p>
              Email:{' '}
              <a href="mailto:admin@ahawc.com" className="text-blue-600 hover:underline">
                admin@ahawc.com
              </a>
            </p>
          </address>
        </Section>

        <div className="flex gap-6 border-t pt-6 text-sm">
          <Link href="/terms" className="text-blue-600 hover:underline">
            Terms &amp; Conditions
          </Link>
          <Link href="/login" className="text-blue-600 hover:underline">
            &lt;- Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 leading-relaxed text-slate-700 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
