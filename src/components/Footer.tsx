export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-600 dark:text-gray-400">
          <p>{`© ${new Date().getFullYear()} bh2980's blog. All rights reserved.`}</p>
        </div>
      </div>
    </footer>
  );
}
