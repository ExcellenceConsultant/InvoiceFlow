import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegalPrivacy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card data-testid="privacy-policy-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Privacy Policy
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent className="prose max-w-none dark:prose-invert">
          <div className="space-y-6" data-testid="privacy-policy-content">
            <section>
              <h3 className="text-lg font-semibold">1. Information We Collect</h3>
              <p>
                Kitchen Express overseas inc ("we," "our," or "us") collects information you provide when using 
                InvoiceFlow, including:
              </p>
              <ul className="list-disc pl-6">
                <li>Business and contact information</li>
                <li>Customer data you enter for invoicing</li>
                <li>Product and inventory information</li>
                <li>Invoice and transaction details</li>
                <li>QuickBooks integration data (when connected)</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold">2. How We Use Your Information</h3>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6">
                <li>Provide invoice management services</li>
                <li>Generate reports and packing lists</li>
                <li>Synchronize data with QuickBooks</li>
                <li>Maintain and improve our service</li>
                <li>Provide customer support</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold">3. QuickBooks Integration</h3>
              <p>
                When you connect InvoiceFlow to QuickBooks, we access your QuickBooks data as necessary 
                to provide synchronization services. This includes customer information, invoices, and 
                accounting data. We do not store QuickBooks data beyond what's necessary for service operation.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">4. Data Storage and Security</h3>
              <p>
                Your data is stored securely using industry-standard encryption and security measures. 
                We implement appropriate safeguards to protect against unauthorized access, alteration, 
                disclosure, or destruction of your information.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">5. Cookies and Tracking</h3>
              <p>
                InvoiceFlow uses essential cookies to maintain your session and provide core functionality. 
                We do not use tracking cookies for advertising or analytics purposes.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">6. Data Sharing</h3>
              <p>
                We do not sell, trade, or share your personal information with third parties except:
              </p>
              <ul className="list-disc pl-6">
                <li>With QuickBooks (when you authorize integration)</li>
                <li>As required by law or legal process</li>
                <li>To protect our rights or property</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold">7. Data Retention</h3>
              <p>
                We retain your information for as long as your account is active or as needed to provide 
                services. You may request deletion of your data by contacting us.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">8. Your Rights</h3>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Disconnect QuickBooks integration at any time</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold">9. International Data Transfers</h3>
              <p>
                Your information may be processed and stored outside your country of residence. 
                We ensure appropriate safeguards are in place for such transfers.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">10. Changes to This Policy</h3>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any 
                material changes by posting the new policy on this page.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">11. Contact Us</h3>
              <p>
                If you have questions about this Privacy Policy, please contact Kitchen Express overseas inc at:
                <br />
                Email: privacy@kitchenexpressoverseas.com
              </p>
            </section>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground italic">
                <strong>Note:</strong> This is a template privacy policy. Please consult with legal counsel 
                to ensure compliance with applicable privacy laws and regulations in your jurisdiction.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}