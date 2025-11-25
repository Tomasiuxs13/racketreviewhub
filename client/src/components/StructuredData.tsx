import { Helmet } from "react-helmet-async";

export interface StructuredDataProps {
  data: object | object[];
}

export function StructuredData({ data }: StructuredDataProps) {
  const payloads = (Array.isArray(data) ? data : [data]).filter(
    (item) => item && Object.keys(item).length > 0,
  );

  if (payloads.length === 0) {
    return null;
  }

  return (
    <Helmet>
      {payloads.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(item),
          }}
        />
      ))}
    </Helmet>
  );
}

