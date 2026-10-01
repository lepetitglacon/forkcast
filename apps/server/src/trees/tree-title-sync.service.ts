import { Injectable } from '@nestjs/common';
import { setTitle } from '@forkcast/doc';
import { CollabService } from '../collab/collab.service';

/**
 * Bridges REST metadata changes to the live Yjs document: the document is the source of
 * truth for the title, so a REST rename is also written into the document.
 */
@Injectable()
export class TreeTitleSyncService {
  constructor(private readonly collab: CollabService) {}

  async setDocumentTitle(treeId: string, title: string, userId: string): Promise<void> {
    await this.collab.withDocument(treeId, { userId, role: 'editor', via: 'rest' }, (doc) => {
      setTitle(doc, title, 'system');
    });
  }

  closeConnections(treeId: string): void {
    this.collab.closeConnections(treeId);
  }
}
