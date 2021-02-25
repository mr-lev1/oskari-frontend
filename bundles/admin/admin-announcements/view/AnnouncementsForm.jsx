import React from "react";
import PropTypes from 'prop-types';
import { Form, Input, Button, Switch, Row } from "antd";
import { Message, Confirm, DateRange } from 'oskari-ui';
import { Controller, LocaleConsumer } from 'oskari-ui/util';
import moment from 'moment';

/*
This file contains the form for admin-announcements.
This is the main file for creating and editing announcements.
*/
const { TextArea } = Input;
const rangeConfig = {
  rules: [
    {
      type: "array",
      required: true,
      message: <Message messageKey='dateError' />
    }
  ]
};

const DATEFORMAT = 'YYYY-MM-DD';

const AnnouncementsForm = ({controller,  title, key, form, index}) => {

  const onFinish  = fieldsValue => {
    // Should format date value before submit.
    const rangeValue = fieldsValue["range_picker"];

    const values = {
      title: fieldsValue["title"],
      content: fieldsValue["content"],
      begin_date: rangeValue[0].format(DATEFORMAT), 
      end_date: rangeValue[1].format(DATEFORMAT),
      active: fieldsValue["active"]
    };

    if (form.id === undefined) {
      controller.saveAnnouncement(values);
    } else {
      values.id = form.id;
      controller.updateAnnouncement(values);
    }
  }
  
  //Set initial values to date range depending on if we are editing or creating an announcement
  const rangeInitial = () => {

    if (form.begin_date && form.end_date) {
      return [moment(form.begin_date, DATEFORMAT), moment(form.end_date, DATEFORMAT)]; 
    } else {
      return [moment(moment(),DATEFORMAT), moment(moment(),DATEFORMAT)];  
    }

  } 

  //Active value set depending on if creating a new announcement or editing an old one
  const activeInitial = () => {
    if(form.active === undefined) {
      return true;
    } else {
      return form.active;
    }
  }

    return (
      <div>
            <Form layout="vertical" 
              onFinish={onFinish} 
              initialValues={{
                title: form.title !== undefined ? form.title : Oskari.getMsg('admin-announcements', 'addNewForm'),
                content: form.content,
                range_picker: rangeInitial(),
                active: activeInitial(),
              }}>
              <Form.Item
                name="title"
                label={<Message messageKey='newAnnouncement.title' />}
                rules={[
                  {
                    required: true,
                    message: <Message messageKey='titleError' />,
                    whitespace: true
                  }
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="content"
                label={<Message messageKey='newAnnouncement.content' />}
                rules={[
                  {
                    required: true,
                    message: <Message messageKey='contentError' />,
                    whitespace: true
                  }
                ]}
              >
                <TextArea rows={4}/>
              </Form.Item>
              <Form.Item
                name="range_picker"
                label={<Message messageKey='newAnnouncement.date-range' />}
                {...rangeConfig}
              >
                <DateRange popupStyle={{zIndex: '999999'}} />
              </Form.Item>
              <Form.Item name="active" label={<Message messageKey='newAnnouncement.show-popup' />} valuePropName="checked">
                <Switch/>
              </Form.Item>
              <Row>
                <Form.Item>
                  <Button type="primary" htmlType="submit" >
                    <Message messageKey={'save'}/>
                  </Button>
                </Form.Item>
                <Form.Item>
                  <Confirm
                      title={<Message messageKey='messages.deleteAnnouncementConfirm'/>}
                      onConfirm={() => controller.deleteAnnouncement(form.id, form.title)}
                      okText={<Message messageKey='yes'/>}
                      cancelText={<Message messageKey='cancel'/>}
                      placement='top'
                      popupStyle={{zIndex: '999999'}}
                  >
                      <Button key={key}>
                          <Message messageKey='delete'/>
                      </Button>
                  </Confirm>
                </Form.Item>
                <Form.Item>
                  <Confirm
                        title={<Message messageKey='messages.cancelAnnouncementConfirm'/>}
                        onConfirm={() => controller.cancel(form.id)}
                        okText={<Message messageKey='yes'/>}
                        cancelText={<Message messageKey='cancel'/>}
                        placement='top'
                        popupStyle={{zIndex: '999999'}}
                    >
                      <Button>
                        <Message messageKey={'cancel'}/>
                      </Button>
                  </Confirm>
                </Form.Item>
              </Row>
            </Form>
      </div>
    );
};

AnnouncementsForm.propTypes = {
  title: PropTypes.string,
  key: PropTypes.number,
  controller: PropTypes.instanceOf(Controller).isRequired
};

const contextWrap = LocaleConsumer(AnnouncementsForm);
export { contextWrap as AnnouncementsForm };