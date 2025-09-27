import { Link } from "wouter";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="print:hidden bg-muted/30 border-t mt-auto" data-testid="app-footer">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright Notice */}
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground" data-testid="copyright-notice">
              © {currentYear} Kitchen Express overseas inc. All rights reserved.
            </p>
          </div>
          
          {/* Legal Links */}
          <div className="flex space-x-6">
            <Link href="/legal/privacy-policy">
              <span 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                data-testid="link-privacy-policy"
              >
                Privacy Policy
              </span>
            </Link>
            <Link href="/legal/eula">
              <span 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                data-testid="link-eula"
              >
                End-User License Agreement
              </span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}