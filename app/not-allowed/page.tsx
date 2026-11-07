export const metadata = { title: "No access · Bagger Finder" };

export default function NotAllowed() {
  return (
    <main className="not-allowed">
      <h1>This account has no access</h1>
      <p>Bagger Finder is limited to specific email addresses. Sign out to try another account, or ask the owner to add this one.</p>
      <form method="post" action="/sign-out">
        <button className="btn" type="submit">Sign out</button>
      </form>
    </main>
  );
}
