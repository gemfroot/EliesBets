type Props = {
  params: Promise<{ slug: string }>;
};

export default async function SportPage({ params }: Props) {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-zinc-50">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Sport: {slug}</p>
    </div>
  );
}
