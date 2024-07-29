import {AfterUpdate, BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn} from "typeorm";

import {User} from "./User";

type UpdatableProperties = 'email' | 'displayEmail';

@Entity({name: 'logins'})
export class Login extends BaseEntity {
  public needsUpdate: boolean = false;

  @PrimaryColumn({type: Number})
  public id: number;

  // This is the normalized email address we use for equality and indexing.
  @Column({type: String})
  public email: string;

  // This is how the user's email address should be displayed.
  @Column({name: 'display_email', type: String})
  public displayEmail: string;

  @Column({name: 'user_id', type: Number})
  public userId: number;

  @ManyToOne(type => User)
  @JoinColumn({name: 'user_id'})
  public user: User;

  public setPropertyIfDifferent<K extends UpdatableProperties, V extends this[K]>(prop: K, value: V){
    if (this[prop] !== value) {
      this[prop] = value;
      this.needsUpdate = true;
    }
  }

  @AfterUpdate()
  public resetNeedsUpdate() {
    this.needsUpdate = false;
  }
}
