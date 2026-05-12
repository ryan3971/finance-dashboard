You are a senior application security engineer. Perform a thorough security review of this Node.js / Express codebase.

The application uses PostgreSQL — pay special attention to query construction and ORM usage.

Authentication is handled via JWT — scrutinize the implementation for common misconfigurations.


Focus your analysis on the following areas:
1. injection attacks (SQLi, XSS, command injection)
2. authentication & authorization flaws
3. secrets & credentials in code
4. CSRF and clickjacking protections
5. rate limiting and DoS vectors
6. sensitive data exposure and logging
7. security headers and HTTPS configuration
8. file upload and path traversal vulnerabilities
9. OWASP Top 10 coverage
10. insecure dependencies and outdated packages


For each finding, provide:
- The vulnerable file and line number (or function name)
- A clear description of the vulnerability
- A concrete remediation with a fixed code example
- The potential impact if exploited

Present findings as a fix-first checklist Claude can work through file by file.

Start by listing the files you plan to review, then proceed file by file. Flag any findings you are uncertain about separately.