import React from "react";
import { AnnouncementsForm } from './AnnouncementsForm';
import PropTypes from 'prop-types';
import { Collapse } from "antd";
import { PlusOutlined } from '@ant-design/icons';
import { Button } from 'oskari-ui';
import { Controller, LocaleConsumer } from 'oskari-ui/util';
import styled from 'styled-components';

/*
Maps all created announcements into a collapse.
*/

const { Panel } = Collapse;

const StyledButton = styled(Button)`
    margin-top: 10px;
`;
const AnnouncementsList = ({controller,  announcements, title, activeKey }) => {

  const callback = (key) => {
    controller.openCollapse(key);
  }
  return (
    <div>
        <div>
        <Collapse accordion activeKey={activeKey} onChange={callback}>
          {announcements.map((form, index) => {
            return (
              <Panel header={form.title ? form.title : Oskari.getMsg('admin-announcements', 'addNewForm')} key={index} >
              <AnnouncementsForm
                controller={controller}
                form={form}
                index={index}
                title={title}
                key={index}
              />
              </Panel>
            );
          })}
          </Collapse>
        </div>

        <StyledButton type="primary" onClick={() => controller.addForm()}>
          <PlusOutlined />
        </StyledButton>
    </div>
    
  );
};

AnnouncementsList.propTypes = {
  controller: PropTypes.instanceOf(Controller).isRequired
};

const contextWrap = LocaleConsumer(AnnouncementsList);
export { contextWrap as AnnouncementsList };