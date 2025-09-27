import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegalEULA() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card data-testid="eula-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            End-User License Agreement (EULA)
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent className="prose max-w-none dark:prose-invert">
          <div className="space-y-6" data-testid="eula-content">
            <section>
              <h3 className="text-lg font-semibold">1. Agreement to Terms</h3>
              <p>
                This End-User License Agreement ("Agreement") is between you and Kitchen Express overseas inc 
                regarding your use of InvoiceFlow and its related services. By using our software, you agree to these terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">2. License Grant</h3>
              <p>
                Kitchen Express overseas inc grants you a personal, non-exclusive, non-transferable license to use 
                InvoiceFlow for your business invoice management needs in accordance with this Agreement.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">3. Permitted Uses</h3>
              <ul className="list-disc pl-6">
                <li>Create and manage invoices for your business</li>
                <li>Track inventory and product information</li>
                <li>Integrate with QuickBooks for accounting purposes</li>
                <li>Generate reports and packing lists</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold">4. Restrictions</h3>
              <p>You may not:</p>
              <ul className="list-disc pl-6">
                <li>Distribute, sublicense, or sell the software</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Use the software for illegal activities</li>
                <li>Remove or modify copyright notices</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold">5. Data and Privacy</h3>
              <p>
                Your use of InvoiceFlow is also governed by our Privacy Policy. We implement appropriate 
                security measures to protect your business data and customer information.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">6. QuickBooks Integration</h3>
              <p>
                InvoiceFlow integrates with QuickBooks Online. Your use of QuickBooks services is subject 
                to Intuit's terms and conditions. We are not responsible for QuickBooks service availability.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">7. Limitation of Liability</h3>
              <p>
                Kitchen Express overseas inc provides InvoiceFlow "as is" without warranties. We shall not be 
                liable for any indirect, incidental, or consequential damages arising from your use of the software.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">8. Termination</h3>
              <p>
                This Agreement remains in effect until terminated. You may terminate it by discontinuing use 
                of InvoiceFlow. We may terminate for breach of these terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">9. Contact Information</h3>
              <p>
                For questions about this Agreement, contact Kitchen Express overseas inc at: 
                <br />
                Email: legal@kitchenexpressoverseas.com
              </p>
            </section>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground italic">
                <strong>Note:</strong> This is a template agreement. Please consult with legal counsel 
                to ensure it meets your specific business requirements and local regulations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}