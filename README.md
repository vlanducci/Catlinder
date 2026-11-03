This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Dependency Packages 
```bash
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Prisma

npx prisma validate
npx prisma generate
npx prisma db push

## Outlook calendar accounts

The Microsoft Entra app must allow the account types you want to connect and
include these Web redirect URIs in its Authentication settings:

- `http://localhost:3000/api/outlook/callback` for local development
- `https://<your-domain>/api/outlook/callback` for production
- `http://localhost:3000/api/google/callback` for local development
- `https://<your-domain>/api/google/callback` for production

Users can connect additional Microsoft accounts from the calendar menu. Each
account must grant calendar and shared-calendar access when prompted. Existing
accounts should be reconnected after shared-calendar permissions are added.

Events on connected Google and Outlook calendars can be edited or deleted from
the calendar. The connected accounts must grant calendar write access.

## Vercel 
https://catlinder.vercel.app/
