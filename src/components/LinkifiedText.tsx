import React from 'react';

// URL을 감지하는 정규식 (http, https 프로토콜을 포함하는 URL)
const urlRegex = /(https?:\/\/[^\s]+)/g;

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

/**
 * 텍스트 내의 URL을 클릭 가능한 링크로 변환하고 줄바꿈을 처리하는 컴포넌트
 */
export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, className }) => {
  if (!text) return null;

  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        // URL인 경우 링크로 변환
        if (part.match(urlRegex)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        // 일반 텍스트 - 줄바꿈 처리
        const lines = part.split('\n');
        return (
          <React.Fragment key={index}>
            {lines.map((line, lineIndex) => (
              <React.Fragment key={`${index}-${lineIndex}`}>
                {line}
                {lineIndex < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};
