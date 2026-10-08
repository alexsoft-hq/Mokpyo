// English translations of all 79 fictional goals in seed-demo.ts.
// IDs are isolated; execution dates are shifted by the English seed.
// No real customer records or credentials are included.
export const projects = [
  {
    "key": "strategy",
    "name": "Product Strategy",
    "description": "Manage product direction, key metrics, and quarterly investment priorities.",
    "parent": null,
    "goals": [
      {
        "id": "demo-en-goal-north-star",
        "projectKey": "strategy",
        "title": "Reach 1,000 weekly active teams",
        "description": "Improve the core collaboration loop and grow active teams that convert to paid plans.",
        "ownerKeys": [
          "owner",
          "pm"
        ],
        "progress": 62,
        "size": "xl",
        "statusKey": "doing",
        "cycleKey": "annual",
        "categoryKeys": [
          "feature",
          "research"
        ],
        "startDate": "2026-01-05",
        "dueDate": "2026-12-18",
        "priority": "p_xl",
        "teams": [
          "team_product",
          "team_frontend",
          "team_backend"
        ],
        "effort": 89,
        "riskNote": "Week-four retention is a bigger bottleneck than new acquisition."
      },
      {
        "id": "demo-en-goal-enterprise",
        "projectKey": "strategy",
        "title": "Meet enterprise security requirements",
        "description": "Bring SSO, audit logs, and data retention policies up to product standards.",
        "ownerKeys": [
          "owner",
          "backend",
          "devops"
        ],
        "progress": 38,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "quality",
          "tech"
        ],
        "startDate": "2026-07-01",
        "dueDate": "2026-11-30",
        "priority": "p_xl",
        "teams": [
          "team_backend",
          "team_platform"
        ],
        "effort": 144,
        "riskNote": "The external security review date is not yet confirmed."
      },
      {
        "id": "demo-en-goal-pricing",
        "projectKey": "strategy",
        "title": "Validate new plans and usage-based billing",
        "description": "Test price sensitivity and feature packaging across customer segments.",
        "ownerKeys": [
          "pm",
          "success"
        ],
        "progress": 100,
        "size": "large",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "research"
        ],
        "startDate": "2026-06-10",
        "dueDate": "2026-08-25",
        "priority": "p_large",
        "teams": [
          "team_product"
        ],
        "effort": 34,
        "riskNote": "Complete: incorporated 12 fictional customer interviews and pricing experiments."
      },
      {
        "id": "demo-en-goal-strategy-portfolio-1",
        "projectKey": "strategy",
        "title": "Establish a quarterly roadmap cadence",
        "description": "Reconcile company priorities and team execution plans every month.",
        "ownerKeys": [
          "owner",
          "pm"
        ],
        "progress": 44,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "operation",
          "growth"
        ],
        "startDate": "2026-07-21",
        "dueDate": "2026-09-09",
        "priority": "p_xl",
        "teams": [
          "team_product"
        ],
        "effort": 55,
        "riskNote": "Team dependency updates follow different schedules and need reconciliation before monthly reviews.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-2",
        "projectKey": "strategy",
        "title": "Make core product metrics 99% reliable",
        "description": "Unify definitions and aggregation pipelines for active teams, retention, and feature adoption.",
        "ownerKeys": [
          "data",
          "pm"
        ],
        "progress": 72,
        "size": "medium",
        "statusKey": "review",
        "cycleKey": "q3",
        "categoryKeys": [
          "data",
          "quality"
        ],
        "startDate": "2026-07-28",
        "dueDate": "2026-09-16",
        "priority": "p_large",
        "teams": [
          "team_data",
          "team_product"
        ],
        "effort": 34,
        "riskNote": "Resolve historical aggregation errors caused by mixed event schemas first.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-3",
        "projectKey": "strategy",
        "title": "Run a 20-company design partner program",
        "description": "Validate new features every two weeks with fictional strategic customers and feed findings into the roadmap.",
        "ownerKeys": [
          "research",
          "success",
          "pm"
        ],
        "progress": 83,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "research",
          "growth"
        ],
        "startDate": "2026-08-03",
        "dueDate": "2026-09-23",
        "priority": "p_large",
        "teams": [
          "team_product",
          "team_success"
        ],
        "effort": 55,
        "riskNote": "Keep common research questions so segment-specific requests do not fragment the program.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-4",
        "projectKey": "strategy",
        "title": "Establish product analytics governance",
        "description": "Document event naming, ownership, retention, and personal data handling.",
        "ownerKeys": [
          "data",
          "security"
        ],
        "progress": 39,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "data",
          "security"
        ],
        "startDate": "2026-08-10",
        "dueDate": "2026-11-13",
        "priority": "p_xl",
        "teams": [
          "team_data",
          "team_security"
        ],
        "effort": 89,
        "riskNote": "Agreement is still needed between data minimization and analytics requirements.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-5",
        "projectKey": "strategy",
        "title": "Run the product decision council",
        "description": "Create evidence, records, and follow-up procedures for major investment and stop decisions.",
        "ownerKeys": [
          "owner",
          "pm",
          "research"
        ],
        "progress": 92,
        "size": "medium",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "operation",
          "research"
        ],
        "startDate": "2026-06-24",
        "dueDate": "2026-09-05",
        "priority": "p_large",
        "teams": [
          "team_product"
        ],
        "effort": 34,
        "riskNote": "Delegation rules are needed to prevent delays when decision makers are absent.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-6",
        "projectKey": "strategy",
        "title": "Prepare a beta launch in Japan",
        "description": "Prepare localization, payments, privacy policies, and early customer support.",
        "ownerKeys": [
          "pm",
          "success",
          "security"
        ],
        "progress": 12,
        "size": "small",
        "statusKey": "todo",
        "cycleKey": "q4",
        "categoryKeys": [
          "growth",
          "security"
        ],
        "startDate": "2026-09-01",
        "dueDate": "2026-12-04",
        "priority": "p_small",
        "teams": [
          "team_product",
          "team_success",
          "team_security"
        ],
        "effort": 21,
        "riskNote": "The legal review schedule for localized privacy notices is tight.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-7",
        "projectKey": "strategy",
        "title": "Design the partner API ecosystem policy",
        "description": "Define public API scope, authentication, rate limits, and partner tiers.",
        "ownerKeys": [
          "backend",
          "security",
          "pm"
        ],
        "progress": 58,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "feature",
          "security"
        ],
        "startDate": "2026-08-17",
        "dueDate": "2026-10-23",
        "priority": "p_medium",
        "teams": [
          "team_backend",
          "team_security"
        ],
        "effort": 55,
        "riskNote": "Partner-specific exceptions may undermine the standard API scope.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-8",
        "projectKey": "strategy",
        "title": "Build a churn-risk response playbook",
        "description": "Define declining usage signals and a shared response workflow for Product and Customer Success.",
        "ownerKeys": [
          "success",
          "data",
          "pm"
        ],
        "progress": 21,
        "size": "medium",
        "statusKey": "hold",
        "cycleKey": "next",
        "categoryKeys": [
          "data",
          "operation"
        ],
        "startDate": "2026-10-05",
        "dueDate": "2027-02-12",
        "priority": "p_small",
        "teams": [
          "team_success",
          "team_data"
        ],
        "effort": 34,
        "riskNote": "Keep manual review because the health score has too many false positives.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-9",
        "projectKey": "strategy",
        "title": "Finalize the 2027 engineering hiring plan",
        "description": "Calculate hiring order and onboarding capacity for each product investment area.",
        "ownerKeys": [
          "owner",
          "devops"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "operation"
        ],
        "startDate": "2026-06-02",
        "dueDate": "2026-08-27",
        "priority": "p_medium",
        "teams": [
          "team_platform",
          "team_product"
        ],
        "effort": 21,
        "riskNote": "Allow enough lead time for senior backend hiring.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-strategy-portfolio-10",
        "projectKey": "strategy",
        "title": "Validate the 2027 product strategy",
        "description": "Test investment hypotheses for AI collaboration, enterprise expansion, and global expansion.",
        "ownerKeys": [
          "owner",
          "research",
          "pm"
        ],
        "progress": 67,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q4",
        "categoryKeys": [
          "research",
          "growth"
        ],
        "startDate": "2026-08-24",
        "dueDate": "2026-11-27",
        "priority": "p_large",
        "teams": [
          "team_product",
          "team_ai"
        ],
        "effort": 55,
        "riskNote": "Use further interviews to investigate conflicts between market data and existing customer demand.",
        "alignedTo": "demo-en-goal-north-star"
      }
    ]
  },
  {
    "key": "web",
    "name": "Web Platform",
    "description": "Develop the core web experience and collaboration features.",
    "parent": "strategy",
    "goals": [
      {
        "id": "demo-en-goal-board",
        "projectKey": "web",
        "title": "Virtualize large project boards",
        "description": "Keep navigation smooth even on boards with 5,000 goals.",
        "ownerKeys": [
          "frontend",
          "backend"
        ],
        "progress": 76,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "quality"
        ],
        "startDate": "2026-07-15",
        "dueDate": "2026-09-12",
        "priority": "p_xl",
        "teams": [
          "team_frontend",
          "team_backend"
        ],
        "effort": 55,
        "riskNote": "Height measurement errors during dragging need further validation.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-permission",
        "projectKey": "web",
        "title": "Introduce project-level permissions",
        "description": "Provide project-specific viewing and editing permissions alongside organization roles.",
        "ownerKeys": [
          "backend",
          "pm"
        ],
        "progress": 24,
        "size": "xl",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "feature",
          "tech"
        ],
        "startDate": "2026-08-20",
        "dueDate": "2026-11-14",
        "priority": "p_large",
        "teams": [
          "team_backend",
          "team_product"
        ],
        "effort": 89,
        "riskNote": "Agree on precedence rules for existing organization permissions.",
        "alignedTo": "demo-en-goal-enterprise"
      },
      {
        "id": "demo-en-goal-a11y",
        "projectKey": "web",
        "title": "Improve core screens to AA accessibility",
        "description": "Improve keyboard navigation, contrast, and screen-reader labels.",
        "ownerKeys": [
          "frontend",
          "design",
          "qa"
        ],
        "progress": 48,
        "size": "medium",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "quality"
        ],
        "startDate": "2026-08-01",
        "dueDate": "2026-09-25",
        "priority": "p_medium",
        "teams": [
          "team_frontend",
          "team_design"
        ],
        "effort": 34,
        "riskNote": "Focus order in complex popover components is under review."
      },
      {
        "id": "demo-en-goal-realtime",
        "projectKey": "web",
        "title": "Build the foundation for real-time co-editing",
        "description": "Reduce conflicts when several users edit the same goal.",
        "ownerKeys": [
          "frontend",
          "backend"
        ],
        "progress": 12,
        "size": "xl",
        "statusKey": "hold",
        "cycleKey": "next",
        "categoryKeys": [
          "research",
          "tech"
        ],
        "startDate": "2026-10-01",
        "dueDate": "2027-02-26",
        "priority": "p_small",
        "teams": [
          "team_frontend",
          "team_backend"
        ],
        "effort": 144,
        "riskNote": "On hold this quarter to prioritize the permission model."
      },
      {
        "id": "demo-en-goal-web-portfolio-1",
        "projectKey": "web",
        "title": "Launch a unified command palette",
        "description": "Create goals, search, and switch projects quickly using only the keyboard.",
        "ownerKeys": [
          "frontend",
          "design"
        ],
        "progress": 44,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "quality"
        ],
        "startDate": "2026-07-21",
        "dueDate": "2026-09-09",
        "priority": "p_xl",
        "teams": [
          "team_frontend",
          "team_design"
        ],
        "effort": 55,
        "riskNote": "Test shortcut conflicts during Korean text composition across browsers.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-2",
        "projectKey": "web",
        "title": "Ship bulk goal editing",
        "description": "Change owners, statuses, cycles, and due dates for multiple goals at once.",
        "ownerKeys": [
          "frontend",
          "backend",
          "qa"
        ],
        "progress": 72,
        "size": "medium",
        "statusKey": "review",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature"
        ],
        "startDate": "2026-07-28",
        "dueDate": "2026-09-16",
        "priority": "p_large",
        "teams": [
          "team_frontend",
          "team_backend"
        ],
        "effort": 34,
        "riskNote": "Finalize rollback behavior and user feedback for partial failures.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-3",
        "projectKey": "web",
        "title": "Add advanced filters and saved searches",
        "description": "Share multi-condition filters and reuse frequent searches with the team.",
        "ownerKeys": [
          "frontend",
          "pm"
        ],
        "progress": 83,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "growth"
        ],
        "startDate": "2026-08-03",
        "dueDate": "2026-09-23",
        "priority": "p_large",
        "teams": [
          "team_frontend",
          "team_product"
        ],
        "effort": 55,
        "riskNote": "Migrate existing saved views and filters to a unified schema.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-4",
        "projectKey": "web",
        "title": "Support keyboard drag and drop",
        "description": "Let users reorder boards and cards with a keyboard and screen reader.",
        "ownerKeys": [
          "frontend",
          "design",
          "qa"
        ],
        "progress": 39,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "quality"
        ],
        "startDate": "2026-08-10",
        "dueDate": "2026-11-13",
        "priority": "p_xl",
        "teams": [
          "team_frontend",
          "team_design"
        ],
        "effort": 89,
        "riskNote": "Usability testing is still needed for spoken reorder announcements.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-5",
        "projectKey": "web",
        "title": "Redesign the real-time notification center",
        "description": "Group mentions, status changes, and due-date alerts by type.",
        "ownerKeys": [
          "frontend",
          "backend"
        ],
        "progress": 92,
        "size": "medium",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "operation"
        ],
        "startDate": "2026-06-24",
        "dueDate": "2026-09-05",
        "priority": "p_large",
        "teams": [
          "team_frontend",
          "team_backend"
        ],
        "effort": 34,
        "riskNote": "Check the synchronization load from marking high volumes of notifications as read.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-6",
        "projectKey": "web",
        "title": "Search audit logs and export CSV",
        "description": "Filter audit history by user, period, and event, then export it for security review.",
        "ownerKeys": [
          "backend",
          "security"
        ],
        "progress": 12,
        "size": "small",
        "statusKey": "todo",
        "cycleKey": "q4",
        "categoryKeys": [
          "security",
          "feature"
        ],
        "startDate": "2026-09-01",
        "dueDate": "2026-12-04",
        "priority": "p_small",
        "teams": [
          "team_backend",
          "team_security"
        ],
        "effort": 21,
        "riskNote": "Coordinate personal data masking rules for exports with the security team.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-7",
        "projectKey": "web",
        "title": "Achieve a 1.8-second LCP on core screens",
        "description": "Optimize initial bundles, data fetching, and rendering for faster perceived performance.",
        "ownerKeys": [
          "frontend",
          "devops"
        ],
        "progress": 58,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "quality",
          "tech"
        ],
        "startDate": "2026-08-17",
        "dueDate": "2026-10-23",
        "priority": "p_medium",
        "teams": [
          "team_frontend",
          "team_platform"
        ],
        "effort": 55,
        "riskNote": "Card data volume in large projects is the main source of performance variance.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-8",
        "projectKey": "web",
        "title": "Migrate to design tokens 2.0",
        "description": "Reorganize colors, spacing, and typography around semantic tokens.",
        "ownerKeys": [
          "design",
          "frontend"
        ],
        "progress": 21,
        "size": "medium",
        "statusKey": "hold",
        "cycleKey": "next",
        "categoryKeys": [
          "tech",
          "quality"
        ],
        "startDate": "2026-10-05",
        "dueDate": "2027-02-12",
        "priority": "p_small",
        "teams": [
          "team_design",
          "team_frontend"
        ],
        "effort": 34,
        "riskNote": "More legacy components still use direct color values than expected.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-9",
        "projectKey": "web",
        "title": "Show API usage and limits",
        "description": "Visualize workspace API usage and estimate when limits will be reached.",
        "ownerKeys": [
          "backend",
          "frontend",
          "data"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "data"
        ],
        "startDate": "2026-06-02",
        "dueDate": "2026-08-27",
        "priority": "p_medium",
        "teams": [
          "team_backend",
          "team_frontend",
          "team_data"
        ],
        "effort": 21,
        "riskNote": "Balance minute-level aggregation costs against freshness.",
        "alignedTo": "demo-en-goal-board"
      },
      {
        "id": "demo-en-goal-web-portfolio-10",
        "projectKey": "web",
        "title": "Launch a work template gallery",
        "description": "Provide project templates for development, marketing, and customer success.",
        "ownerKeys": [
          "pm",
          "design",
          "success"
        ],
        "progress": 67,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q4",
        "categoryKeys": [
          "feature",
          "growth"
        ],
        "startDate": "2026-08-24",
        "dueDate": "2026-11-27",
        "priority": "p_large",
        "teams": [
          "team_product",
          "team_design"
        ],
        "effort": 55,
        "riskNote": "Define template quality standards and publication approval first.",
        "alignedTo": "demo-en-goal-board"
      }
    ]
  },
  {
    "key": "mobile",
    "name": "Mobile Experience",
    "description": "Build the iOS and Android experience and push notifications.",
    "parent": "strategy",
    "goals": [
      {
        "id": "demo-en-goal-ios",
        "projectKey": "mobile",
        "title": "Launch the iOS beta",
        "description": "Release the first TestFlight build focused on goals, check-ins, and notifications.",
        "ownerKeys": [
          "pm",
          "frontend",
          "design"
        ],
        "progress": 68,
        "size": "xl",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature"
        ],
        "startDate": "2026-06-20",
        "dueDate": "2026-09-30",
        "priority": "p_xl",
        "teams": [
          "team_frontend",
          "team_design"
        ],
        "effort": 110,
        "riskNote": "Conflict handling in offline synchronization puts the schedule at risk.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-push",
        "projectKey": "mobile",
        "title": "Deliver personalized push notifications",
        "description": "Provide due-date alerts, mentions, and check-in reminders for each user.",
        "ownerKeys": [
          "frontend",
          "backend"
        ],
        "progress": 42,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q4",
        "categoryKeys": [
          "feature",
          "operation"
        ],
        "startDate": "2026-08-18",
        "dueDate": "2026-10-20",
        "priority": "p_large",
        "teams": [
          "team_frontend",
          "team_backend"
        ],
        "effort": 55,
        "riskNote": "Measure notification permission conversion on each platform."
      },
      {
        "id": "demo-en-goal-android",
        "projectKey": "mobile",
        "title": "Validate the Android technology approach",
        "description": "Compare shared UI strategies with native implementation costs.",
        "ownerKeys": [
          "frontend",
          "qa"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "research"
        ],
        "startDate": "2026-07-01",
        "dueDate": "2026-08-10",
        "priority": "p_medium",
        "teams": [
          "team_frontend"
        ],
        "effort": 21,
        "riskNote": "Kotlin Multiplatform was selected as the leading candidate."
      },
      {
        "id": "demo-en-goal-mobile-portfolio-1",
        "projectKey": "mobile",
        "title": "Release the Android alpha",
        "description": "Distribute an internal alpha with core goal viewing and check-ins.",
        "ownerKeys": [
          "mobile",
          "qa",
          "design"
        ],
        "progress": 44,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "quality"
        ],
        "startDate": "2026-07-21",
        "dueDate": "2026-09-09",
        "priority": "p_xl",
        "teams": [
          "team_mobile",
          "team_design"
        ],
        "effort": 55,
        "riskNote": "List scrolling on low-end devices is below the performance target.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-2",
        "projectKey": "mobile",
        "title": "Support offline goal viewing",
        "description": "Keep recent projects and goals available when connectivity is unreliable.",
        "ownerKeys": [
          "mobile",
          "backend"
        ],
        "progress": 72,
        "size": "medium",
        "statusKey": "review",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "tech"
        ],
        "startDate": "2026-07-28",
        "dueDate": "2026-09-16",
        "priority": "p_large",
        "teams": [
          "team_mobile",
          "team_backend"
        ],
        "effort": 34,
        "riskNote": "Define security rules for cache expiry and revoked permissions.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-3",
        "projectKey": "mobile",
        "title": "Add biometric sign-in recovery",
        "description": "Quickly unlock a session with Face ID or a fingerprint.",
        "ownerKeys": [
          "mobile",
          "security"
        ],
        "progress": 83,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "security",
          "feature"
        ],
        "startDate": "2026-08-03",
        "dueDate": "2026-09-23",
        "priority": "p_large",
        "teams": [
          "team_mobile",
          "team_security"
        ],
        "effort": 55,
        "riskNote": "Validate token revocation and recovery when a device is lost.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-4",
        "projectKey": "mobile",
        "title": "Route notification deep links",
        "description": "Open the exact goal, comment, or project from a push notification.",
        "ownerKeys": [
          "mobile",
          "backend"
        ],
        "progress": 39,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "feature",
          "quality"
        ],
        "startDate": "2026-08-10",
        "dueDate": "2026-11-13",
        "priority": "p_xl",
        "teams": [
          "team_mobile",
          "team_backend"
        ],
        "effort": 89,
        "riskNote": "Fallback screens for links with revoked access are not yet consistent.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-5",
        "projectKey": "mobile",
        "title": "Optimize tablet split-screen layouts",
        "description": "Browse lists and details together on iPad and foldable devices.",
        "ownerKeys": [
          "mobile",
          "design"
        ],
        "progress": 92,
        "size": "medium",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature"
        ],
        "startDate": "2026-06-24",
        "dueDate": "2026-09-05",
        "priority": "p_large",
        "teams": [
          "team_mobile",
          "team_design"
        ],
        "effort": 34,
        "riskNote": "Large dynamic text causes conflicts between the panels' minimum widths.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-6",
        "projectKey": "mobile",
        "title": "Achieve 99.9% crash-free sessions",
        "description": "Establish crash collection, symbol uploads, and release regression monitoring.",
        "ownerKeys": [
          "mobile",
          "qa",
          "devops"
        ],
        "progress": 12,
        "size": "small",
        "statusKey": "todo",
        "cycleKey": "q4",
        "categoryKeys": [
          "quality",
          "operation"
        ],
        "startDate": "2026-09-01",
        "dueDate": "2026-12-04",
        "priority": "p_small",
        "teams": [
          "team_mobile",
          "team_platform"
        ],
        "effort": 21,
        "riskNote": "Narrow down the conditions that reproduce background synchronization crashes.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-7",
        "projectKey": "mobile",
        "title": "Automate the app store review checklist",
        "description": "Check permission wording, privacy labels, and build settings before release.",
        "ownerKeys": [
          "mobile",
          "security",
          "qa"
        ],
        "progress": 58,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "operation",
          "security"
        ],
        "startDate": "2026-08-17",
        "dueDate": "2026-10-23",
        "priority": "p_medium",
        "teams": [
          "team_mobile",
          "team_security"
        ],
        "effort": 55,
        "riskNote": "Assign an owner to keep the checklist current with store policy changes.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-8",
        "projectKey": "mobile",
        "title": "Build a today’s goals home widget",
        "description": "Show upcoming goals and personal check-ins on the home screen.",
        "ownerKeys": [
          "mobile",
          "design",
          "pm"
        ],
        "progress": 21,
        "size": "medium",
        "statusKey": "hold",
        "cycleKey": "next",
        "categoryKeys": [
          "feature",
          "growth"
        ],
        "startDate": "2026-10-05",
        "dueDate": "2027-02-12",
        "priority": "p_small",
        "teams": [
          "team_mobile",
          "team_design"
        ],
        "effort": 34,
        "riskNote": "Experiment with freshness within widget refresh limits.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-9",
        "projectKey": "mobile",
        "title": "Establish mobile behavior analytics",
        "description": "Compare onboarding, notification, and check-in funnels across platforms.",
        "ownerKeys": [
          "data",
          "mobile",
          "pm"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "data",
          "growth"
        ],
        "startDate": "2026-06-02",
        "dueDate": "2026-08-27",
        "priority": "p_medium",
        "teams": [
          "team_data",
          "team_mobile"
        ],
        "effort": 21,
        "riskNote": "Separate event definitions before and after iOS tracking consent.",
        "alignedTo": "demo-en-goal-ios"
      },
      {
        "id": "demo-en-goal-mobile-portfolio-10",
        "projectKey": "mobile",
        "title": "Recruit a 300-person beta community",
        "description": "Organize beta groups by role and collect weekly usability feedback.",
        "ownerKeys": [
          "success",
          "research",
          "mobile"
        ],
        "progress": 67,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q4",
        "categoryKeys": [
          "research",
          "growth"
        ],
        "startDate": "2026-08-24",
        "dueDate": "2026-11-27",
        "priority": "p_large",
        "teams": [
          "team_success",
          "team_mobile"
        ],
        "effort": 55,
        "riskNote": "Define incentives and a feedback response cadence that sustain participation.",
        "alignedTo": "demo-en-goal-ios"
      }
    ]
  },
  {
    "key": "ai",
    "name": "AI & Automation",
    "description": "Explore AI assistance for goals, reporting, and risk detection.",
    "parent": "strategy",
    "goals": [
      {
        "id": "demo-en-goal-summary",
        "projectKey": "ai",
        "title": "Build a weekly goal summary copilot",
        "description": "Draft weekly reports from change history and check-ins.",
        "ownerKeys": [
          "ai",
          "pm",
          "backend"
        ],
        "progress": 81,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "research"
        ],
        "startDate": "2026-07-10",
        "dueDate": "2026-09-15",
        "priority": "p_xl",
        "teams": [
          "team_ai",
          "team_backend",
          "team_product"
        ],
        "effort": 55,
        "riskNote": "Validate factual accuracy criteria with the fictional customer cohort.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-risk-ai",
        "projectKey": "ai",
        "title": "Detect schedule risks early",
        "description": "Analyze delay signals and dependencies to suggest goals at risk.",
        "ownerKeys": [
          "ai",
          "backend"
        ],
        "progress": 36,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "research",
          "feature"
        ],
        "startDate": "2026-08-01",
        "dueDate": "2026-12-05",
        "priority": "p_large",
        "teams": [
          "team_ai",
          "team_backend"
        ],
        "effort": 89,
        "riskNote": "There are not yet enough delay examples for training."
      },
      {
        "id": "demo-en-goal-ai-guardrail",
        "projectKey": "ai",
        "title": "Establish AI response safety evaluation",
        "description": "Automatically evaluate prompt regressions, personal data exposure, and hallucinations.",
        "ownerKeys": [
          "ai",
          "qa"
        ],
        "progress": 54,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "quality",
          "research"
        ],
        "startDate": "2026-08-12",
        "dueDate": "2026-11-08",
        "priority": "p_large",
        "teams": [
          "team_ai",
          "team_platform"
        ],
        "effort": 55,
        "riskNote": "Expand the evaluation set for Korean workplace contexts."
      },
      {
        "id": "demo-en-goal-ai-portfolio-1",
        "projectKey": "ai",
        "title": "Build an AI goal drafting assistant",
        "description": "Suggest measurable goals and subgoals from a short problem description.",
        "ownerKeys": [
          "ai",
          "pm",
          "research"
        ],
        "progress": 44,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "research"
        ],
        "startDate": "2026-07-21",
        "dueDate": "2026-09-09",
        "priority": "p_xl",
        "teams": [
          "team_ai",
          "team_product"
        ],
        "effort": 55,
        "riskNote": "Add context inputs to reduce overly generic suggestions.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-2",
        "projectKey": "ai",
        "title": "Extract action items from meeting notes",
        "description": "Structure owners, due dates, and decisions into candidate goals.",
        "ownerKeys": [
          "ai",
          "backend"
        ],
        "progress": 72,
        "size": "medium",
        "statusKey": "review",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "data"
        ],
        "startDate": "2026-07-28",
        "dueDate": "2026-09-16",
        "priority": "p_large",
        "teams": [
          "team_ai",
          "team_backend"
        ],
        "effort": 34,
        "riskNote": "Owner matching accuracy is below target for people with the same name.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-3",
        "projectKey": "ai",
        "title": "Add semantic search for workspace goals",
        "description": "Find related goals, decisions, and comments despite differences in wording.",
        "ownerKeys": [
          "ai",
          "backend",
          "data"
        ],
        "progress": 83,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "research"
        ],
        "startDate": "2026-08-03",
        "dueDate": "2026-09-23",
        "priority": "p_large",
        "teams": [
          "team_ai",
          "team_backend",
          "team_data"
        ],
        "effort": 55,
        "riskNote": "Measure search quality variation caused by organization-specific terminology.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-4",
        "projectKey": "ai",
        "title": "Link AI answers to their sources",
        "description": "Show the check-ins, comments, and change history behind each summary and recommendation.",
        "ownerKeys": [
          "ai",
          "frontend",
          "qa"
        ],
        "progress": 39,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "quality",
          "feature"
        ],
        "startDate": "2026-08-10",
        "dueDate": "2026-11-13",
        "priority": "p_xl",
        "teams": [
          "team_ai",
          "team_frontend"
        ],
        "effort": 89,
        "riskNote": "Handle reference integrity when source material has been deleted.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-5",
        "projectKey": "ai",
        "title": "Build a model cost dashboard",
        "description": "Track token usage and unit cost by feature, organization, and model.",
        "ownerKeys": [
          "ai",
          "data",
          "devops"
        ],
        "progress": 92,
        "size": "medium",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "data",
          "operation"
        ],
        "startDate": "2026-06-24",
        "dueDate": "2026-09-05",
        "priority": "p_large",
        "teams": [
          "team_ai",
          "team_data",
          "team_platform"
        ],
        "effort": 34,
        "riskNote": "Define cost attribution for requests served from cache.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-6",
        "projectKey": "ai",
        "title": "Version prompts alongside code",
        "description": "Manage prompt changes, evaluation results, and rollback history with the product code.",
        "ownerKeys": [
          "ai",
          "devops",
          "qa"
        ],
        "progress": 12,
        "size": "small",
        "statusKey": "todo",
        "cycleKey": "q4",
        "categoryKeys": [
          "tech",
          "quality"
        ],
        "startDate": "2026-09-01",
        "dueDate": "2026-12-04",
        "priority": "p_small",
        "teams": [
          "team_ai",
          "team_platform"
        ],
        "effort": 21,
        "riskNote": "Agree on promotion rules from experimental prompts to production versions.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-7",
        "projectKey": "ai",
        "title": "Mask personal data in AI inputs",
        "description": "Detect and remove emails, phone numbers, and customer identifiers before model calls.",
        "ownerKeys": [
          "security",
          "ai",
          "backend"
        ],
        "progress": 58,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "security",
          "quality"
        ],
        "startDate": "2026-08-17",
        "dueDate": "2026-10-23",
        "priority": "p_medium",
        "teams": [
          "team_security",
          "team_ai"
        ],
        "effort": 55,
        "riskNote": "Improve detection of Korean addresses and internal identifier formats.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-8",
        "projectKey": "ai",
        "title": "Route tasks across multiple models",
        "description": "Select suitable models based on quality, latency, and cost requirements.",
        "ownerKeys": [
          "ai",
          "backend",
          "data"
        ],
        "progress": 21,
        "size": "medium",
        "statusKey": "hold",
        "cycleKey": "next",
        "categoryKeys": [
          "tech",
          "data"
        ],
        "startDate": "2026-10-05",
        "dueDate": "2027-02-12",
        "priority": "p_small",
        "teams": [
          "team_ai",
          "team_backend"
        ],
        "effort": 34,
        "riskNote": "Define fallback thresholds and acceptable quality loss during provider outages.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-9",
        "projectKey": "ai",
        "title": "Build an AI feedback learning loop",
        "description": "Collect user ratings and edits as evidence for quality improvement.",
        "ownerKeys": [
          "research",
          "ai",
          "data"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "research",
          "data"
        ],
        "startDate": "2026-06-02",
        "dueDate": "2026-08-27",
        "priority": "p_medium",
        "teams": [
          "team_ai",
          "team_data"
        ],
        "effort": 21,
        "riskNote": "Separate personal writing preferences from objective accuracy signals.",
        "alignedTo": "demo-en-goal-summary"
      },
      {
        "id": "demo-en-goal-ai-portfolio-10",
        "projectKey": "ai",
        "title": "Automate AI release gates",
        "description": "Promote only models that meet accuracy, safety, latency, and cost thresholds.",
        "ownerKeys": [
          "qa",
          "ai",
          "devops"
        ],
        "progress": 67,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q4",
        "categoryKeys": [
          "quality",
          "operation"
        ],
        "startDate": "2026-08-24",
        "dueDate": "2026-11-27",
        "priority": "p_large",
        "teams": [
          "team_ai",
          "team_platform"
        ],
        "effort": 55,
        "riskNote": "More hidden test cases are needed to prevent evaluation-set overfitting.",
        "alignedTo": "demo-en-goal-summary"
      }
    ]
  },
  {
    "key": "dx",
    "name": "Developer Experience",
    "description": "Improve CI/CD, observability, development environments, and release reliability.",
    "parent": null,
    "goals": [
      {
        "id": "demo-en-goal-ci",
        "projectKey": "dx",
        "title": "Reduce average CI time from 12 to 5 minutes",
        "description": "Apply caching, test sharding, and change-impact-based execution.",
        "ownerKeys": [
          "devops",
          "qa"
        ],
        "progress": 73,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "quality",
          "tech"
        ],
        "startDate": "2026-07-05",
        "dueDate": "2026-09-20",
        "priority": "p_large",
        "teams": [
          "team_platform"
        ],
        "effort": 55,
        "riskNote": "The cost of isolating parallel E2E tests is higher than expected."
      },
      {
        "id": "demo-en-goal-observability",
        "projectKey": "dx",
        "title": "Standardize service observability",
        "description": "Unify logs, metrics, traces, and SLO dashboards.",
        "ownerKeys": [
          "devops",
          "backend"
        ],
        "progress": 57,
        "size": "large",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "operation",
          "quality"
        ],
        "startDate": "2026-06-15",
        "dueDate": "2026-09-10",
        "priority": "p_large",
        "teams": [
          "team_platform",
          "team_backend"
        ],
        "effort": 55,
        "riskNote": "Only agent deployment in the production region remains."
      },
      {
        "id": "demo-en-goal-local-dev",
        "projectKey": "dx",
        "title": "Set up new developers in under 30 minutes",
        "description": "Provide a container-based local database and one-click initialization.",
        "ownerKeys": [
          "devops",
          "frontend"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "tech",
          "quality"
        ],
        "startDate": "2026-07-20",
        "dueDate": "2026-08-28",
        "priority": "p_medium",
        "teams": [
          "team_platform",
          "team_frontend"
        ],
        "effort": 34,
        "riskNote": "Complete: validated the macOS and Linux onboarding documentation."
      },
      {
        "id": "demo-en-goal-dx-portfolio-1",
        "projectKey": "dx",
        "title": "Create preview environments for every PR",
        "description": "Validate frontend and API changes together at review-specific URLs.",
        "ownerKeys": [
          "devops",
          "frontend",
          "backend"
        ],
        "progress": 44,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "operation"
        ],
        "startDate": "2026-07-21",
        "dueDate": "2026-09-09",
        "priority": "p_xl",
        "teams": [
          "team_platform",
          "team_frontend"
        ],
        "effort": 55,
        "riskNote": "Isolation is expensive for PRs that change the database schema.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-2",
        "projectKey": "dx",
        "title": "Keep flaky tests below 1%",
        "description": "Track flaky tests automatically using failure history and isolated execution.",
        "ownerKeys": [
          "qa",
          "devops"
        ],
        "progress": 72,
        "size": "medium",
        "statusKey": "review",
        "cycleKey": "q3",
        "categoryKeys": [
          "quality",
          "tech"
        ],
        "startDate": "2026-07-28",
        "dueDate": "2026-09-16",
        "priority": "p_large",
        "teams": [
          "team_platform"
        ],
        "effort": 34,
        "riskNote": "Failure classification is not yet automated for tests that depend on external APIs.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-3",
        "projectKey": "dx",
        "title": "Automate dependency updates",
        "description": "Create and validate security and patch updates according to risk.",
        "ownerKeys": [
          "security",
          "devops"
        ],
        "progress": 83,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "security",
          "operation"
        ],
        "startDate": "2026-08-03",
        "dueDate": "2026-09-23",
        "priority": "p_large",
        "teams": [
          "team_security",
          "team_platform"
        ],
        "effort": 55,
        "riskNote": "Major upgrades require approval from the responsible team and must not auto-merge.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-4",
        "projectKey": "dx",
        "title": "Provide anonymized development DB snapshots",
        "description": "Improve local debugging with realistic data stripped of sensitive information.",
        "ownerKeys": [
          "backend",
          "security",
          "devops"
        ],
        "progress": 39,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "data",
          "security"
        ],
        "startDate": "2026-08-10",
        "dueDate": "2026-11-13",
        "priority": "p_xl",
        "teams": [
          "team_backend",
          "team_security"
        ],
        "effort": 89,
        "riskNote": "Broaden personal data detection in free-form notes.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-5",
        "projectKey": "dx",
        "title": "Run quarterly incident response drills",
        "description": "Validate detection, communication, and recovery with realistic incident scenarios.",
        "ownerKeys": [
          "devops",
          "backend",
          "support"
        ],
        "progress": 92,
        "size": "medium",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "operation",
          "quality"
        ],
        "startDate": "2026-06-24",
        "dueDate": "2026-09-05",
        "priority": "p_large",
        "teams": [
          "team_platform",
          "team_backend"
        ],
        "effort": 34,
        "riskNote": "Find a drill format that reduces the burden of participation outside working hours.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-6",
        "projectKey": "dx",
        "title": "Manage the feature flag lifecycle",
        "description": "Connect flag creation, gradual rollout, expiry, and removal in one workflow.",
        "ownerKeys": [
          "devops",
          "frontend",
          "backend"
        ],
        "progress": 12,
        "size": "small",
        "statusKey": "todo",
        "cycleKey": "q4",
        "categoryKeys": [
          "tech",
          "operation"
        ],
        "startDate": "2026-09-01",
        "dueDate": "2026-12-04",
        "priority": "p_small",
        "teams": [
          "team_platform",
          "team_frontend"
        ],
        "effort": 21,
        "riskNote": "Analyze the user impact of long-abandoned flags.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-7",
        "projectKey": "dx",
        "title": "Build a change-impact dependency graph",
        "description": "Build and test only changed packages and their dependents for faster feedback.",
        "ownerKeys": [
          "devops",
          "frontend"
        ],
        "progress": 58,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "tech",
          "quality"
        ],
        "startDate": "2026-08-17",
        "dueDate": "2026-10-23",
        "priority": "p_medium",
        "teams": [
          "team_platform",
          "team_frontend"
        ],
        "effort": 55,
        "riskNote": "Some dynamic import paths are missing from graph analysis.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-8",
        "projectKey": "dx",
        "title": "Automate production secret rotation",
        "description": "Rotate database, external API, and signing keys without downtime.",
        "ownerKeys": [
          "security",
          "devops",
          "backend"
        ],
        "progress": 21,
        "size": "medium",
        "statusKey": "hold",
        "cycleKey": "next",
        "categoryKeys": [
          "security",
          "operation"
        ],
        "startDate": "2026-10-05",
        "dueDate": "2027-02-12",
        "priority": "p_small",
        "teams": [
          "team_security",
          "team_platform"
        ],
        "effort": 34,
        "riskNote": "Some legacy workers do not support overlapping key validity periods.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-9",
        "projectKey": "dx",
        "title": "Establish a regular load-testing baseline",
        "description": "Measure weekly performance regressions for key APIs and large boards.",
        "ownerKeys": [
          "qa",
          "devops",
          "backend"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "quality",
          "data"
        ],
        "startDate": "2026-06-02",
        "dueDate": "2026-08-27",
        "priority": "p_medium",
        "teams": [
          "team_platform",
          "team_backend"
        ],
        "effort": 21,
        "riskNote": "Reflect production-like goal distributions in the test data.",
        "alignedTo": "demo-en-goal-ci"
      },
      {
        "id": "demo-en-goal-dx-portfolio-10",
        "projectKey": "dx",
        "title": "Unify the developer documentation portal",
        "description": "Search architecture, APIs, operational runbooks, and onboarding docs in one place.",
        "ownerKeys": [
          "devops",
          "backend",
          "support"
        ],
        "progress": 67,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q4",
        "categoryKeys": [
          "operation",
          "tech"
        ],
        "startDate": "2026-08-24",
        "dueDate": "2026-11-27",
        "priority": "p_large",
        "teams": [
          "team_platform"
        ],
        "effort": 55,
        "riskNote": "Define rules connecting documentation freshness to code ownership.",
        "alignedTo": "demo-en-goal-ci"
      }
    ]
  },
  {
    "key": "success",
    "name": "Customer Success",
    "description": "Manage onboarding, feedback, support operations, and product adoption.",
    "parent": null,
    "goals": [
      {
        "id": "demo-en-goal-onboarding",
        "projectKey": "success",
        "title": "Deliver first value within 7 days",
        "description": "Use sample templates and guided tours to shorten the time to running goals.",
        "ownerKeys": [
          "success",
          "design",
          "pm"
        ],
        "progress": 64,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "operation"
        ],
        "startDate": "2026-07-15",
        "dueDate": "2026-09-30",
        "priority": "p_xl",
        "teams": [
          "team_product",
          "team_design"
        ],
        "effort": 55,
        "riskNote": "Industry templates vary significantly in how well they fit.",
        "alignedTo": "demo-en-goal-north-star"
      },
      {
        "id": "demo-en-goal-feedback",
        "projectKey": "success",
        "title": "Classify customer feedback within 48 hours",
        "description": "Automatically classify support feedback by product area and urgency.",
        "ownerKeys": [
          "success",
          "ai"
        ],
        "progress": 29,
        "size": "medium",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "operation",
          "research"
        ],
        "startDate": "2026-08-25",
        "dueDate": "2026-10-31",
        "priority": "p_medium",
        "teams": [
          "team_product",
          "team_ai"
        ],
        "effort": 34,
        "riskNote": "Define personal data masking policies for each channel."
      },
      {
        "id": "demo-en-goal-sla",
        "projectKey": "success",
        "title": "Achieve a 95% support SLA",
        "description": "Establish priority-based response procedures and weekly operations reviews.",
        "ownerKeys": [
          "success",
          "qa"
        ],
        "progress": 91,
        "size": "medium",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "operation",
          "quality"
        ],
        "startDate": "2026-06-01",
        "dueDate": "2026-09-05",
        "priority": "p_large",
        "teams": [
          "team_product"
        ],
        "effort": 21,
        "riskNote": "Only the weekend emergency response rotation needs final agreement."
      },
      {
        "id": "demo-en-goal-success-portfolio-1",
        "projectKey": "success",
        "title": "Publish 12 industry onboarding templates",
        "description": "Help fictional SaaS, manufacturing, and professional services teams get started.",
        "ownerKeys": [
          "success",
          "design",
          "research"
        ],
        "progress": 44,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "growth"
        ],
        "startDate": "2026-07-21",
        "dueDate": "2026-09-09",
        "priority": "p_xl",
        "teams": [
          "team_success",
          "team_design"
        ],
        "effort": 55,
        "riskNote": "Review industry terminology against actual workflow needs.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-2",
        "projectKey": "success",
        "title": "Automate customer health scores",
        "description": "Combine activity, goal completion, and support history to identify risk early.",
        "ownerKeys": [
          "data",
          "success",
          "pm"
        ],
        "progress": 72,
        "size": "medium",
        "statusKey": "review",
        "cycleKey": "q3",
        "categoryKeys": [
          "data",
          "operation"
        ],
        "startDate": "2026-07-28",
        "dueDate": "2026-09-16",
        "priority": "p_large",
        "teams": [
          "team_data",
          "team_success"
        ],
        "effort": 34,
        "riskNote": "Low usage at small accounts is being incorrectly classified as risk.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-3",
        "projectKey": "success",
        "title": "Automate quarterly business review reports",
        "description": "Assemble outcomes, adoption, major issues, and next-quarter recommendations.",
        "ownerKeys": [
          "success",
          "ai",
          "data"
        ],
        "progress": 83,
        "size": "large",
        "statusKey": "validate",
        "cycleKey": "q3",
        "categoryKeys": [
          "feature",
          "data"
        ],
        "startDate": "2026-08-03",
        "dueDate": "2026-09-23",
        "priority": "p_large",
        "teams": [
          "team_success",
          "team_ai"
        ],
        "effort": 55,
        "riskNote": "Map each fictional customer's contractual objectives to product metrics.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-4",
        "projectKey": "success",
        "title": "Redesign the support knowledge base",
        "description": "Use unsuccessful searches to improve help structure and content.",
        "ownerKeys": [
          "support",
          "success",
          "research"
        ],
        "progress": 39,
        "size": "xl",
        "statusKey": "risk",
        "cycleKey": "q4",
        "categoryKeys": [
          "operation",
          "quality"
        ],
        "startDate": "2026-08-10",
        "dueDate": "2026-11-13",
        "priority": "p_xl",
        "teams": [
          "team_success"
        ],
        "effort": 89,
        "riskNote": "Update outdated screenshots and product terminology in bulk.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-5",
        "projectKey": "success",
        "title": "Build an account expansion playbook",
        "description": "Standardize signals and proposals for expansion from active teams into other departments.",
        "ownerKeys": [
          "success",
          "pm",
          "data"
        ],
        "progress": 92,
        "size": "medium",
        "statusKey": "deploy",
        "cycleKey": "q3",
        "categoryKeys": [
          "growth",
          "data"
        ],
        "startDate": "2026-06-24",
        "dueDate": "2026-09-05",
        "priority": "p_large",
        "teams": [
          "team_success",
          "team_product"
        ],
        "effort": 34,
        "riskNote": "Tune the criteria so expansion outreach does not feel excessive.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-6",
        "projectKey": "success",
        "title": "Run a monthly customer advisory council",
        "description": "Use a fictional 15-company panel to review product direction and beta features.",
        "ownerKeys": [
          "research",
          "success",
          "owner"
        ],
        "progress": 12,
        "size": "small",
        "statusKey": "todo",
        "cycleKey": "q4",
        "categoryKeys": [
          "research",
          "growth"
        ],
        "startDate": "2026-09-01",
        "dueDate": "2026-12-04",
        "priority": "p_small",
        "teams": [
          "team_success",
          "team_product"
        ],
        "effort": 21,
        "riskNote": "Prevent one industry's views from dominating the roadmap.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-7",
        "projectKey": "success",
        "title": "Address renewal risk 90 days ahead",
        "description": "Combine product, support, and relationship signals 90 days before contract expiry.",
        "ownerKeys": [
          "success",
          "data",
          "support"
        ],
        "progress": 58,
        "size": "large",
        "statusKey": "doing",
        "cycleKey": "q4",
        "categoryKeys": [
          "operation",
          "data"
        ],
        "startDate": "2026-08-17",
        "dueDate": "2026-10-23",
        "priority": "p_medium",
        "teams": [
          "team_success",
          "team_data"
        ],
        "effort": 55,
        "riskNote": "Contract data synchronization delays some fictional account alerts.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-8",
        "projectKey": "success",
        "title": "Reach a 4.7 support satisfaction score",
        "description": "Analyze satisfaction and repeat contacts by inquiry type to improve support quality.",
        "ownerKeys": [
          "support",
          "success",
          "qa"
        ],
        "progress": 21,
        "size": "medium",
        "statusKey": "hold",
        "cycleKey": "next",
        "categoryKeys": [
          "quality",
          "operation"
        ],
        "startDate": "2026-10-05",
        "dueDate": "2027-02-12",
        "priority": "p_small",
        "teams": [
          "team_success"
        ],
        "effort": 34,
        "riskNote": "Interview underrepresented segments with low survey response rates.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-9",
        "projectKey": "success",
        "title": "Create a partner certification program",
        "description": "Help implementation partners independently support onboarding and operations.",
        "ownerKeys": [
          "success",
          "support",
          "pm"
        ],
        "progress": 100,
        "size": "medium",
        "statusKey": "done",
        "cycleKey": "q3",
        "categoryKeys": [
          "growth",
          "operation"
        ],
        "startDate": "2026-06-02",
        "dueDate": "2026-08-27",
        "priority": "p_medium",
        "teams": [
          "team_success",
          "team_product"
        ],
        "effort": 21,
        "riskNote": "Training sandbox accounts and assessment criteria are behind schedule.",
        "alignedTo": "demo-en-goal-onboarding"
      },
      {
        "id": "demo-en-goal-success-portfolio-10",
        "projectKey": "success",
        "title": "Standardize incident communications",
        "description": "Define timing and wording for impact notices, progress updates, and post-incident reports.",
        "ownerKeys": [
          "support",
          "devops",
          "success"
        ],
        "progress": 67,
        "size": "large",
        "statusKey": "review",
        "cycleKey": "q4",
        "categoryKeys": [
          "operation",
          "quality"
        ],
        "startDate": "2026-08-24",
        "dueDate": "2026-11-27",
        "priority": "p_large",
        "teams": [
          "team_success",
          "team_platform"
        ],
        "effort": 55,
        "riskNote": "Use consistent rules to translate technical status into customer impact.",
        "alignedTo": "demo-en-goal-onboarding"
      }
    ]
  }
] as const;
