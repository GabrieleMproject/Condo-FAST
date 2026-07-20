import DOMPurify from 'dompurify';

// Hook globale per assicurarsi che i link esterni (es. in preview email) 
// aprano in un nuovo tab senza perdere lo stato React e senza rischi di sicurezza
DOMPurify.addHook('afterSanitizeAttributes', function(node) {
  if ('target' in node || node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeHtml(htmlString) {
  return DOMPurify.sanitize(htmlString || '', {
    FORBID_TAGS: ['style', 'script'], // Prevenzione Global Style Bleeding (CSS Injection)
    ADD_ATTR: ['target']
  });
}
