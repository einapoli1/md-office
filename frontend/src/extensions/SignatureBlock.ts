import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import SignatureBlockView from '../components/SignatureBlockView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    signatureBlock: {
      insertSignatureBlock: (attrs?: Partial<SignatureBlockAttrs>) => ReturnType;
    };
  }
}

export interface SignatureBlockAttrs {
  signerName: string;
  signerOrg: string;
  date: string;
  fingerprint: string;
  signatureImage: string;
  status: 'pending' | 'signed' | 'verified' | 'invalid';
}

export const SignatureBlock = Node.create({
  name: 'signatureBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      signerName: { default: '' },
      signerOrg: { default: '' },
      date: { default: '' },
      fingerprint: { default: '' },
      signatureImage: { default: '' },
      status: { default: 'pending' as const },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-signature-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-signature-block': '', class: 'signature-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SignatureBlockView);
  },

  addCommands() {
    return {
      insertSignatureBlock: (attrs = {}) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
        });
      },
    };
  },
});

export default SignatureBlock;
