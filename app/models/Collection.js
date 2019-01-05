// @flow
import invariant from 'invariant';
import { map, without, pick, filter } from 'lodash';
import { action, computed, observable } from 'mobx';
import BaseModel from 'models/BaseModel';
import Document from 'models/Document';
import User from 'models/User';
import { client } from 'utils/ApiClient';
import type { NavigationNode } from 'types';

export default class Collection extends BaseModel {
  @observable isSaving: boolean;
  @observable isLoadingUsers: boolean;
  @observable userIds: string[] = [];

  id: string;
  name: string;
  description: string;
  color: string;
  private: boolean;
  type: 'atlas' | 'journal';
  documents: NavigationNode[];
  createdAt: ?string;
  updatedAt: ?string;
  url: string;

  @computed
  get isEmpty(): boolean {
    return this.documents.length === 0;
  }

  @computed
  get documentIds(): string[] {
    const results = [];
    const travelDocuments = (documentList, path) =>
      documentList.forEach(document => {
        results.push(document.id);
        travelDocuments(document.children);
      });

    travelDocuments(this.documents);
    return results;
  }

  @computed
  get users(): User[] {
    return filter(this.store.rootStore.users.active, user =>
      this.userIds.includes(user.id)
    );
  }

  @action
  async fetchUsers() {
    this.isLoadingUsers = true;

    try {
      const res = await client.post('/collections.users', { id: this.id });
      invariant(res && res.data, 'User data should be available');
      this.userIds = map(res.data, user => user.id);
      res.data.forEach(this.store.rootStore.users.add);
    } finally {
      this.isLoadingUsers = false;
    }
  }

  @action
  async addUser(user: User) {
    await client.post('/collections.add_user', {
      id: this.id,
      userId: user.id,
    });
    this.userIds = this.userIds.concat(user.id);
  }

  @action
  async removeUser(user: User) {
    await client.post('/collections.remove_user', {
      id: this.id,
      userId: user.id,
    });
    this.userIds = without(this.userIds, user.id);
  }

  @action
  updateDocument(document: Document) {
    const travelDocuments = (documentList, path) =>
      documentList.forEach(d => {
        if (d.id === document.id) {
          d.title = document.title;
          d.url = document.url;
        } else {
          travelDocuments(d.children);
        }
      });

    travelDocuments(this.documents);
  }

  toJS = () => {
    return pick(this, ['id', 'name', 'color', 'description', 'private']);
  };

  export = () => {
    return client.post('/collections.export', { id: this.id });
  };
}
