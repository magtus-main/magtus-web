import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Building,
  Mail,
  Phone,
  FileText,
  Lock,
  Globe,
  UserCheck,
  ExternalLink,
  Clock,
  CheckCircle2,
  HelpCircle,
  Scale,
} from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Magtus Hardware",
  description:
    "Learn how Magtus Hardware collects, processes, stores, discloses, and safeguards your personal data.",
};

const SECTIONS = [
  { id: "controller", title: "1. Data Controller" },
  { id: "collection", title: "2. Information We Collect" },
  { id: "legal-grounds", title: "3. Legal Grounds & Purposes" },
  { id: "data-sharing", title: "4. How We Share Data" },
  { id: "retention", title: "5. Data Retention" },
  { id: "cookies", title: "6. Cookies & Tracking" },
  { id: "security", title: "7. Data Security" },
  { id: "transfers", title: "8. International Transfers" },
  { id: "rights", title: "9. Your Rights & Choices" },
  { id: "third-party", title: "10. Third-Party Websites" },
  { id: "updates", title: "11. Updates to Policy" },
  { id: "grievances", title: "12. Contact & Grievances" },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="policy-root">
      {/* Background Ambience */}
      <div className="policy-bg" />
      <div className="policy-glow policy-glow-1" />
      <div className="policy-glow policy-glow-2" />

      {/* Top Navigation */}
      <header className="policy-nav-header">
        <div className="policy-container policy-nav-inner">
          <Link href="/" className="policy-logo-link">
            <Image
              src="/magtus_logo.png"
              alt="Magtus Hardware"
              width={140}
              height={45}
              priority
              className="policy-logo-img"
            />
          </Link>
          <Link href="/" className="policy-back-link">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="policy-main">
        <div className="policy-container">
          {/* Hero Banner */}
          <div className="policy-hero">
            <div className="policy-badge">
              <ShieldCheck size={14} />
              <span>Legal & Privacy</span>
            </div>
            <h1 className="policy-hero-title">Privacy Policy</h1>
            <p className="policy-hero-subtitle">Magtus Hardware</p>
            <div className="policy-meta-bar">
              <div className="policy-meta-pill">
                <span className="policy-meta-label">Effective Date:</span>
                <span className="policy-meta-value">October 1, 2026</span>
              </div>
              <div className="policy-meta-pill">
                <span className="policy-meta-label">Last Updated:</span>
                <span className="policy-meta-value">October 1, 2026</span>
              </div>
            </div>
            <p className="policy-intro">
              At <strong>Magtus Hardware</strong> (hereinafter referred to as &ldquo;Magtus,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
              we respect your privacy and are committed to protecting the personal data of our customers, architects,
              interior designers, trade partners, distributors, and website visitors.
            </p>
            <p className="policy-intro">
              This Privacy Policy explains how we collect, process, store, disclose, and safeguard your personal information when
              you visit our website{" "}
              <a
                href="https://www.magtus.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="policy-inline-link"
              >
                www.magtus.co.in
              </a>{" "}
              (the &ldquo;Website&rdquo;), use our digital services, download product catalogs or technical specifications, or
              engage with us for commercial inquiries and orders.
            </p>
          </div>

          {/* Quick Navigation / Table of Contents */}
          <div className="policy-toc-card">
            <div className="policy-toc-header">
              <FileText size={18} className="policy-toc-icon" />
              <span>Table of Contents</span>
            </div>
            <div className="policy-toc-grid">
              {SECTIONS.map((sec) => (
                <a key={sec.id} href={`#${sec.id}`} className="policy-toc-item">
                  <span className="policy-toc-dot" />
                  <span>{sec.title}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Content Document */}
          <div className="policy-card-body">
            {/* Section 1 */}
            <section id="controller" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">01</span>
                <h2>Data Controller and Contact Information</h2>
              </div>
              <p className="policy-text">
                The entity responsible for processing your personal data (the Data Controller) is:
              </p>
              <div className="policy-contact-grid">
                <div className="policy-contact-item">
                  <Building className="policy-item-icon" size={18} />
                  <div>
                    <span className="policy-item-title">Company Name</span>
                    <span className="policy-item-value">Magtus Hardware</span>
                  </div>
                </div>
                {/* Corporate Identification / Tax ID: In process
                <div className="policy-contact-item">
                  <FileText className="policy-item-icon" size={18} />
                  <div>
                    <span className="policy-item-title">Corporate Identification / Tax ID</span>
                    <span className="policy-item-value">In Process</span>
                  </div>
                </div>
                */}
                <div className="policy-contact-item">
                  <Mail className="policy-item-icon" size={18} />
                  <div>
                    <span className="policy-item-title">General Inquiries</span>
                    <a href="mailto:info@magtus.co.in" className="policy-item-link">
                      info@magtus.co.in
                    </a>
                  </div>
                </div>
                <div className="policy-contact-item">
                  <ShieldCheck className="policy-item-icon" size={18} />
                  <div>
                    <span className="policy-item-title">Data Privacy / Grievance Contact</span>
                    <a href="mailto:info@magtus.co.in" className="policy-item-link">
                      info@magtus.co.in
                    </a>
                  </div>
                </div>
                <div className="policy-contact-item">
                  <Phone className="policy-item-icon" size={18} />
                  <div>
                    <span className="policy-item-title">Phone</span>
                    <a href="tel:+919327921602" className="policy-item-link">
                      +91 93279 21602
                    </a>
                  </div>
                </div>
                <div className="policy-contact-item">
                  <Building className="policy-item-icon" size={18} />
                  <div>
                    <span className="policy-item-title">Registered Address</span>
                    <span className="policy-item-value">Bhatar, Surat, Gujarat, India</span>
                  </div>
                </div>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 2 */}
            <section id="collection" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">02</span>
                <h2>Categories of Information We Collect</h2>
              </div>
              <p className="policy-text">
                Depending on how you interact with Magtus Hardware, we collect the following categories of information:
              </p>

              <div className="policy-subcard">
                <h3 className="policy-subheading">A. Information You Provide Directly</h3>
                <ul className="policy-bullet-list">
                  <li>
                    <strong>Identity and Contact Data:</strong> Full name, business designation/title, company or firm
                    name, type of business (e.g., dealer, fabricator, architect, interior designer, contractor, end
                    consumer), billing address, delivery address, email address, and phone numbers.
                  </li>
                  <li>
                    <strong>Commercial and Transactional Data:</strong> Details regarding requested quotes, purchase
                    orders, products browsed or purchased (e.g., hinges, drawer systems, sliding solutions, handles,
                    architectural fittings), warranty registrations, and payment confirmations.{" "}
                    <em>
                      (Note: Payment processing is handled via secure third-party gateways; we do not store full
                      credit/debit card numbers).
                    </em>
                  </li>
                  <li>
                    <strong>Technical Inquiries and Customer Service:</strong> Information submitted via &ldquo;Contact
                    Us&rdquo; forms, sample requests, dealer/distributor application forms, CAD/technical drawing download
                    requests, and customer support tickets.
                  </li>
                  <li>
                    <strong>Marketing Preferences:</strong> Your preferences in receiving newsletters, product launch
                    announcements, trade show invitations, and promotional communications.
                  </li>
                </ul>
              </div>

              <div className="policy-subcard">
                <h3 className="policy-subheading">B. Information Collected Automatically</h3>
                <ul className="policy-bullet-list">
                  <li>
                    <strong>Technical and Device Data:</strong> Internet Protocol (IP) address, browser type and version,
                    time zone setting, operating system, device identifiers, and network information.
                  </li>
                  <li>
                    <strong>Usage and Analytics Data:</strong> Information about how you navigate and interact with our
                    Website, including pages viewed, time spent per page, search terms used, links clicked, and referring
                    websites.
                  </li>
                  <li>
                    <strong>Cookies and Tracking Technologies:</strong> Small data files stored on your device to ensure
                    core site functionality, remember your preferences, and analyze web traffic (see Section 6).
                  </li>
                </ul>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 3 */}
            <section id="legal-grounds" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">03</span>
                <h2>Legal Grounds and Purposes for Data Processing</h2>
              </div>
              <p className="policy-text">
                We process your personal information only when there is a valid lawful basis to do so:
              </p>

              <div className="policy-table-wrapper">
                <table className="policy-table">
                  <thead>
                    <tr>
                      <th style={{ width: "35%" }}>Purpose / Activity</th>
                      <th style={{ width: "30%" }}>Type of Data</th>
                      <th style={{ width: "35%" }}>Lawful Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="policy-table-activity">
                        <strong>Catalog &amp; Technical File Downloads</strong>
                        <span>(e.g., CAD data, dimension sheets)</span>
                      </td>
                      <td>Identity, Contact, Technical</td>
                      <td>
                        Legitimate interests to provide requested product resources and evaluate product interest.
                      </td>
                    </tr>
                    <tr>
                      <td className="policy-table-activity">
                        <strong>Quote Requests &amp; Sales Fulfillment</strong>
                        <span>(processing orders, delivery, billing)</span>
                      </td>
                      <td>Identity, Contact, Commercial, Transactional</td>
                      <td>
                        Performance of a contract or steps taken prior to entering into a contract.
                      </td>
                    </tr>
                    <tr>
                      <td className="policy-table-activity">
                        <strong>Dealer / Distributor Applications</strong>
                      </td>
                      <td>Identity, Contact, Business / Financial credentials</td>
                      <td>
                        Legitimate interest and steps prior to contractual onboarding.
                      </td>
                    </tr>
                    <tr>
                      <td className="policy-table-activity">
                        <strong>Customer Support &amp; After-Sales Service</strong>
                        <span>(warranty claims, product support)</span>
                      </td>
                      <td>Identity, Contact, Transactional</td>
                      <td>
                        Performance of a contract and legitimate interest in providing customer care.
                      </td>
                    </tr>
                    <tr>
                      <td className="policy-table-activity">
                        <strong>Marketing &amp; Product Updates</strong>
                        <span>(email newsletters, event invitations)</span>
                      </td>
                      <td>Contact, Marketing preferences</td>
                      <td>
                        Explicit consent (opt-in) or legitimate business interest for existing trade clients (with opt-out rights).
                      </td>
                    </tr>
                    <tr>
                      <td className="policy-table-activity">
                        <strong>Website Security &amp; Performance</strong>
                      </td>
                      <td>Technical, Usage Data</td>
                      <td>
                        Legitimate interest to maintain platform stability, prevent fraud, and optimize user experience.
                      </td>
                    </tr>
                    <tr>
                      <td className="policy-table-activity">
                        <strong>Statutory Compliance</strong>
                        <span>(tax records, invoices, legal obligations)</span>
                      </td>
                      <td>Transactional, Contact</td>
                      <td>Legal and statutory obligation.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 4 */}
            <section id="data-sharing" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">04</span>
                <h2>How We Share Your Data</h2>
              </div>
              <p className="policy-text">
                We do not sell, rent, or trade your personal data. We share your information only under the following limited circumstances:
              </p>

              <div className="policy-sharing-grid">
                <div className="policy-sharing-item">
                  <div className="policy-item-badge">1</div>
                  <div>
                    <h4>Service Providers and Processors</h4>
                    <p>
                      Trusted third-party vendors who assist in operating our business, including website hosting
                      providers, cloud infrastructure services, CRM systems, IT maintenance, logistics and freight
                      partners (for hardware deliveries), and email delivery services. All such vendors are bound by
                      strict confidentiality and data processing agreements.
                    </p>
                  </div>
                </div>

                <div className="policy-sharing-item">
                  <div className="policy-item-badge">2</div>
                  <div>
                    <h4>Authorized Distribution Network</h4>
                    <p>
                      Where appropriate to serve your query (e.g., product availability, localized installation services,
                      or local quotations), we may route your contact details to an authorized Magtus regional
                      distributor, dealer, or service partner in your area.
                    </p>
                  </div>
                </div>

                <div className="policy-sharing-item">
                  <div className="policy-item-badge">3</div>
                  <div>
                    <h4>Legal and Regulatory Compliance</h4>
                    <p>
                      When required by law, court order, or governmental authority, or when necessary to protect our legal
                      rights, investigate fraud, or enforce our Terms of Use.
                    </p>
                  </div>
                </div>

                <div className="policy-sharing-item">
                  <div className="policy-item-badge">4</div>
                  <div>
                    <h4>Business Reorganization</h4>
                    <p>
                      In connection with any merger, acquisition, restructuring, or sale of corporate assets, customer
                      data may be transferred as an asset under binding confidentiality terms.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 5 */}
            <section id="retention" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">05</span>
                <h2>Data Retention</h2>
              </div>
              <p className="policy-text">
                We retain your personal data only for as long as necessary to fulfill the purposes outlined in this policy:
              </p>

              <div className="policy-retention-grid">
                <div className="policy-retention-card">
                  <div className="policy-retention-period">2 to 3 Years</div>
                  <h4>Inquiry &amp; Quotation Records</h4>
                  <p>Retained for up to 2 to 3 years following the last active communication.</p>
                </div>
                <div className="policy-retention-card">
                  <div className="policy-retention-period">7 to 10 Years</div>
                  <h4>Commercial &amp; Transactional</h4>
                  <p>Retained for statutory periods mandated by commercial, tax, and accounting regulations.</p>
                </div>
                <div className="policy-retention-card">
                  <div className="policy-retention-period">Until Withdrawn</div>
                  <h4>Marketing Communications</h4>
                  <p>Retained until you withdraw your consent or exercise your right to unsubscribe.</p>
                </div>
                <div className="policy-retention-card">
                  <div className="policy-retention-period">12 to 24 Months</div>
                  <h4>Web Log &amp; Analytics Data</h4>
                  <p>Anonymized or purged typically within 12 to 24 months.</p>
                </div>
              </div>

              <div className="policy-callout-note">
                <Clock size={16} />
                <span>
                  Once the retention period expires, personal data is either securely deleted or permanently anonymized.
                </span>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 6 */}
            <section id="cookies" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">06</span>
                <h2>Cookies and Tracking Technologies</h2>
              </div>
              <p className="policy-text">
                Our Website uses cookies and similar tools to distinguish you from other users. These include:
              </p>

              <ul className="policy-bullet-list">
                <li>
                  <strong>Strictly Necessary Cookies:</strong> Essential for the website to function, enable navigation,
                  and secure forms.
                </li>
                <li>
                  <strong>Functional Cookies:</strong> Remember your settings (e.g., language selection, catalog download
                  history).
                </li>
                <li>
                  <strong>Analytical / Performance Cookies:</strong> Help us understand site traffic patterns and optimize
                  page layouts (e.g., Google Analytics). IP anonymization is implemented where applicable.
                </li>
                <li>
                  <strong>Marketing Cookies:</strong> Track browsing habits across websites to deliver targeted hardware
                  advertisements.
                </li>
              </ul>

              <div className="policy-manage-cookies-card">
                <h4>Managing Cookies</h4>
                <p>
                  You can modify your cookie settings at any time via our Website&apos;s cookie banner or through your browser
                  preferences. Disabling necessary cookies may impact the functionality of certain website tools (e.g.,
                  product configurators or cart systems).
                </p>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 7 */}
            <section id="security" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">07</span>
                <h2>Data Security</h2>
              </div>
              <p className="policy-text">
                We implement appropriate technical and organizational measures to safeguard your personal data against
                unauthorized access, loss, alteration, or disclosure. These measures include:
              </p>

              <div className="policy-security-grid">
                <div className="policy-security-item">
                  <Lock className="policy-item-icon" size={20} />
                  <div>
                    <h4>SSL / TLS Encryption</h4>
                    <p>Secure Socket Layer (SSL/TLS) encryption for all transmitted data across our network.</p>
                  </div>
                </div>
                <div className="policy-security-item">
                  <UserCheck className="policy-item-icon" size={20} />
                  <div>
                    <h4>Strict Access Controls</h4>
                    <p>
                      Access controls restricting data availability solely to authorized employees and contractors on a
                      need-to-know basis.
                    </p>
                  </div>
                </div>
                <div className="policy-security-item">
                  <ShieldCheck className="policy-item-icon" size={20} />
                  <div>
                    <h4>Security Assessments &amp; Firewalls</h4>
                    <p>Regular security assessments, active firewalls, and secure modern hosting environments.</p>
                  </div>
                </div>
              </div>

              <div className="policy-callout-note policy-callout-warning">
                <span>
                  While we strive to use commercially acceptable means to protect your data, no transmission over the
                  internet or electronic storage system is 100% secure.
                </span>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 8 */}
            <section id="transfers" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">08</span>
                <h2>International Data Transfers</h2>
              </div>
              <p className="policy-text">
                If your personal data is transferred across borders (for instance, to cloud servers or service providers
                located outside your home jurisdiction), Magtus Hardware ensures that appropriate safeguards are
                established, such as Standard Contractual Clauses (SCCs), adequacy decisions, or statutory-approved
                cross-border transfer mechanisms.
              </p>
            </section>

            <hr className="policy-divider" />

            {/* Section 9 */}
            <section id="rights" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">09</span>
                <h2>Your Rights and Choices</h2>
              </div>
              <p className="policy-text">
                Depending on your jurisdiction (such as GDPR in Europe, DPDP Act in India, or state data laws in the US),
                you have specific statutory rights regarding your personal data:
              </p>

              <div className="policy-rights-grid">
                <div className="policy-right-card">
                  <div className="policy-right-icon-wrap">
                    <CheckCircle2 size={16} />
                  </div>
                  <h4>Right to Access</h4>
                  <p>Request confirmation and copies of the personal data we hold about you.</p>
                </div>

                <div className="policy-right-card">
                  <div className="policy-right-icon-wrap">
                    <CheckCircle2 size={16} />
                  </div>
                  <h4>Right to Rectification</h4>
                  <p>Request correction of inaccurate or incomplete personal information.</p>
                </div>

                <div className="policy-right-card">
                  <div className="policy-right-icon-wrap">
                    <CheckCircle2 size={16} />
                  </div>
                  <h4>Right to Erasure</h4>
                  <p>
                    &ldquo;Right to be Forgotten&rdquo;: Request deletion of your data where retention is no longer justified.
                  </p>
                </div>

                <div className="policy-right-card">
                  <div className="policy-right-icon-wrap">
                    <CheckCircle2 size={16} />
                  </div>
                  <h4>Right to Restrict / Object</h4>
                  <p>Object to data processing based on legitimate interest or direct marketing.</p>
                </div>

                <div className="policy-right-card">
                  <div className="policy-right-icon-wrap">
                    <CheckCircle2 size={16} />
                  </div>
                  <h4>Right to Data Portability</h4>
                  <p>Request transfer of your data to another service provider in a structured, machine-readable format.</p>
                </div>

                <div className="policy-right-card">
                  <div className="policy-right-icon-wrap">
                    <CheckCircle2 size={16} />
                  </div>
                  <h4>Right to Withdraw Consent</h4>
                  <p>Where processing is based on consent, you may withdraw your consent at any time without affecting past lawful processing.</p>
                </div>
              </div>

              <div className="policy-rights-action">
                <Mail size={20} className="policy-rights-action-icon" />
                <div>
                  <p>
                    To exercise any of these rights, email us at{" "}
                    <a href="mailto:info@magtus.co.in" className="policy-inline-link">
                      info@magtus.co.in
                    </a>
                    . We will respond to verified requests within the statutory timeframe (typically within 30 days).
                  </p>
                </div>
              </div>
            </section>

            <hr className="policy-divider" />

            {/* Section 10 */}
            <section id="third-party" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">10</span>
                <h2>Links to Third-Party Websites</h2>
              </div>
              <p className="policy-text">
                Our Website may contain links to third-party websites, such as trade associations, industry partners, or
                social media platforms. We do not control and are not responsible for the privacy practices or content of
                third-party websites. We encourage you to review their privacy policies before providing personal
                details.
              </p>
            </section>

            <hr className="policy-divider" />

            {/* Section 11 */}
            <section id="updates" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">11</span>
                <h2>Updates to This Policy</h2>
              </div>
              <p className="policy-text">
                We may periodically revise this Privacy Policy to reflect operational updates, technological advancements,
                or regulatory changes. Any modifications will be posted on this page with an updated &ldquo;Effective
                Date.&rdquo; We encourage you to review this policy periodically.
              </p>
            </section>

            <hr className="policy-divider" />

            {/* Section 12 */}
            <section id="grievances" className="policy-section">
              <div className="policy-section-header">
                <span className="policy-section-num">12</span>
                <h2>Contact &amp; Grievances</h2>
              </div>
              <p className="policy-text">
                If you have any questions, concerns, or complaints regarding this Privacy Policy or how Magtus Hardware
                handles your data, please contact our Data Protection / Grievance Officer:
              </p>

              <div className="policy-grievance-card">
                <div className="policy-grievance-badge">
                  <Scale size={16} />
                  <span>Official Contact</span>
                </div>
                <div className="policy-grievance-details">
                  <div className="policy-grievance-row">
                    <span className="policy-grievance-label">Attn:</span>
                    <span className="policy-grievance-val">Data Protection Officer / Grievance Officer</span>
                  </div>
                  <div className="policy-grievance-row">
                    <span className="policy-grievance-label">Company:</span>
                    <span className="policy-grievance-val">Magtus Hardware</span>
                  </div>
                  <div className="policy-grievance-row">
                    <span className="policy-grievance-label">Address:</span>
                    <span className="policy-grievance-val">Bhatar, Surat, Gujarat, India</span>
                  </div>
                  <div className="policy-grievance-row">
                    <span className="policy-grievance-label">Contact:</span>
                    <a href="tel:+919327921602" className="policy-inline-link">
                      +91 93279 21602
                    </a>
                  </div>
                  <div className="policy-grievance-row">
                    <span className="policy-grievance-label">Email:</span>
                    <a href="mailto:info@magtus.co.in" className="policy-inline-link">
                      info@magtus.co.in
                    </a>
                  </div>
                  <div className="policy-grievance-row">
                    <span className="policy-grievance-label">Response Time:</span>
                    <span className="policy-grievance-val">
                      We aim to acknowledge and address all concerns promptly within [e.g., 30 business days].
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Bottom Back Button */}
          <div className="policy-footer-back">
            <Link href="/" className="policy-back-btn">
              <ArrowLeft size={18} />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="policy-footer">
        <div className="policy-container policy-footer-inner">
          <p className="policy-footer-copy">
            &copy; {new Date().getFullYear()} Magtus Hardware. All rights reserved.
          </p>
          <div className="policy-footer-links">
            <Link href="/" className="policy-footer-link">
              Home
            </Link>
            <span className="policy-footer-sep">&bull;</span>
            <Link href="/privacy-policy" className="policy-footer-link">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
